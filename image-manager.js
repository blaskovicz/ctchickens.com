// --- BACKGROUND JOB: RUNS HOURLY ---
function runJanitor() {
    console.log("🧹 JANITOR RUN STARTED at " + new Date().toString());
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Breeders");
    
    // 1. READ DATA
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    // 2. DYNAMICALLY FIND COLUMNS
    var getColIndex = function(name) {
      for (var i = 0; i < headers.length; i++) {
        if (headers[i].toString().toLowerCase().trim().replace(/ /g, "_") === name) return i;
      }
      return -1;
    };
    
    var folderIdIndex = getColIndex("gallery_folder_id");
    var cacheIndex = getColIndex("image_cache_json");
    var nameIndex = getColIndex("name"); // Assuming "Name" or "name" column exists
    
    // Safety Check
    if (folderIdIndex === -1 || cacheIndex === -1) {
      console.error("❌ CRITICAL: Could not find 'gallery_folder_id' or 'image_cache_json' columns.");
      return;
    }
  
    console.log("📊 Metadata: Found 'gallery_folder_id' at col " + folderIdIndex + ", 'image_cache_json' at col " + cacheIndex);
  
    // 3. LOOP THROUGH EACH BREEDER
    var updatedCount = 0;
    var errorCount = 0;
  
    for (var i = 1; i < data.length; i++) {
      var folderId = data[i][folderIdIndex];
      // Use the Name column if found, otherwise use Row #
      var farmName = (nameIndex > -1) ? data[i][nameIndex] : ("Row " + (i + 1));
      var currentCache = data[i][cacheIndex];
      
      // A. IF NO FOLDER, CLEAR CACHE
      if (!folderId || folderId === "") {
        if (currentCache !== "") {
          console.log("   Info: Clearing cache for [" + farmName + "] (No folder ID assigned)");
          sheet.getRange(i + 1, cacheIndex + 1).setValue("");
        }
        continue;
      }
  
      try {
        console.log("🔍 Scanning: [" + farmName + "] (Folder: " + folderId + ")");
        
        var folder = DriveApp.getFolderById(folderId);

        // --- NEW: DELETE SUBFOLDERS (Enforce flat structure) ---
        var subfolders = folder.getFolders();
        while (subfolders.hasNext()) {
          var sub = subfolders.next();
          console.warn("      🗑️ DELETING UNAUTHORIZED FOLDER: " + sub.getName());
          sub.setTrashed(true);
        }

        var files = folder.getFiles();
        var MAX_SIZE = 10 * 1024 * 1024; // 10MB Limit
        
        var imageList = [];
        var logo = null;
        var fileCount = 0;
        
        while (files.hasNext()) {
          var file = files.next();
          fileCount++;
          
          var fileName = file.getName();
          var fileSize = file.getSize();
          var fileType = file.getMimeType();
          
          // --- NEW: Identify Readme ---
          var isReadme = fileName === "PHOTO_README.txt";

          // B. DELETE OVERSIZE FILES (Skip Readme)
          if (!isReadme && fileSize > MAX_SIZE) {
            console.warn("      🗑️ DELETING OVERSIZE: " + fileName + " (" + (fileSize/1024/1024).toFixed(2) + "MB)");
            file.setTrashed(true);
            continue;
          }
          
          // C. PROCESS IMAGES
          if (fileType.indexOf('image') > -1) {
             
             // Ensure Public Permission
             if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
               file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
               console.log("      🔓 Permissions updated for: " + fileName);
             }
             
             // Generate Fast Link (using webContentLink or thumbnail hack)
             // NOTE: The URL pattern in your original script is specific. Keeping it as is.
             var rawUrl = "https://lh3.googleusercontent.com/d/" + file.getId() + "=w800";
             
             // Simple Base64 Encode
             // (Note: Base64 encoding a URL usually isn't necessary for JSON, but keeping your logic)
             var encoded = Utilities.base64Encode(rawUrl);
             
             // Sort: Logo vs Gallery
             if (fileName.toLowerCase().indexOf('logo') > -1) {
               console.log("      🏷️ Found Logo: " + fileName);
               logo = encoded; // Assuming logic: one logo per folder
             } else {
               console.log("      🖼️ Found Image: " + fileName);
               imageList.push(encoded);
             }
          } 
          // D. KEEP README
          else if (isReadme) {
             console.log("      📄 Found Readme: " + fileName);
          }
          // E. DELETE ANYTHING ELSE
          else {
             console.log("      🗑️ DELETING JUNK: " + fileName + " (" + fileType + ")");
             file.setTrashed(true);
          }
        }
        
        // D. WRITE TO SPREADSHEET
        // Only write if we found something or if we need to clear an old cache
        var cacheObj = {
          logo: logo,
          images: imageList
        };
        
        var newJson = JSON.stringify(cacheObj);
        
        // Optimization: Only write to sheet if the data is different
        if (currentCache !== newJson) {
           sheet.getRange(i + 1, cacheIndex + 1).setValue(newJson);
           console.log("   ✅ CACHE UPDATED for [" + farmName + "] (" + imageList.length + " images)");
           updatedCount++;
        } else {
           console.log("   zzz No changes for [" + farmName + "]");
        }
        
      } catch (e) {
        console.error("   ❌ ERROR processing [" + farmName + "]: " + e.message);
        errorCount++;
      }
    }
    
    console.log("🏁 JANITOR RUN COMPLETE.");
    console.log("   - Rows Updated: " + updatedCount);
    console.log("   - Errors: " + errorCount);
}