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

        // --- ENFORCE FLAT STRUCTURE ---
        var subfolders = folder.getFolders();
        while (subfolders.hasNext()) {
          var sub = subfolders.next();
          console.warn("      🗑️ REMOVING UNAUTHORIZED FOLDER: " + sub.getName());
          try {
            folder.removeFolder(sub); // Use remove instead of setTrashed
          } catch(e) {
            console.error("      ❌ Failed to remove subfolder: " + e.message);
          }
        }

        // --- COLLECT & SORT FILES (Newest First) ---
        var fileIterator = folder.getFiles();
        var allFiles = [];
        while (fileIterator.hasNext()) {
            allFiles.push(fileIterator.next());
        }

        // Sort Descending (Newest date = index 0)
        allFiles.sort(function(a, b) {
            return b.getLastUpdated().getTime() - a.getLastUpdated().getTime();
        });

        var MAX_SIZE = 10 * 1024 * 1024; // 10MB Limit
        var MAX_GALLERY_IMAGES = 10; // Limit per breeder
        
        var imageList = [];
        var logo = null;
        var galleryCount = 0;
        
        // Iterate through sorted files
        for (var k = 0; k < allFiles.length; k++) {
          var file = allFiles[k];
          
          var fileName = file.getName();
          var fileSize = file.getSize();
          var fileType = file.getMimeType();
          
          // --- Identify Readme ---
          var isReadme = fileName === "PHOTO_README.txt";

          // B. REMOVE OVERSIZE FILES (Skip Readme)
          if (!isReadme && fileSize > MAX_SIZE) {
            console.warn("      🗑️ REMOVING OVERSIZE: " + fileName + " (" + (fileSize/1024/1024).toFixed(2) + "MB)");
            try {
              folder.removeFile(file);
            } catch(e) {
              console.error("      ❌ Failed to remove oversize file: " + e.message);
            }
            continue;
          }
          
          // C. PROCESS IMAGES
          if (fileType.indexOf('image') > -1) {
             
             // Try to update permissions, but don't crash if breeder restricted it
             try {
               if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
                 file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                 console.log("      🔓 Permissions updated for: " + fileName);
               }
             } catch(e) {
               console.warn("      ⚠️ Warning: Could not set permissions for " + fileName + ". The owner may have restricted sharing.");
             }
             
             // Generate Fast Link
             var rawUrl = "https://lh3.googleusercontent.com/d/" + file.getId() + "=w800";
             
             // Simple Base64 Encode
             var encoded = Utilities.base64Encode(rawUrl);
             
             // Sort: Logo vs Gallery
             if (fileName.toLowerCase().indexOf('logo') > -1) {
               console.log("      🏷️ Found Logo: " + fileName);
               logo = encoded; 
             } else {
               // --- CHECK LIMIT ---
               if (galleryCount < MAX_GALLERY_IMAGES) {
                   console.log("      🖼️ Found Image (" + (galleryCount + 1) + "/" + MAX_GALLERY_IMAGES + "): " + fileName);
                   imageList.push(encoded);
                   galleryCount++;
               } else {
                   // This file is older than the top 10, so we remove it from the folder
                   console.warn("      🗑️ REMOVING EXCESS IMAGE (>10): " + fileName);
                   try {
                     folder.removeFile(file);
                   } catch(e) {
                     console.error("      ❌ Failed to remove excess file: " + e.message);
                   }
               }
             }
          } 
          // D. KEEP README
          else if (isReadme) {
             console.log("      📄 Found Readme: " + fileName);
          }
          // E. REMOVE ANYTHING ELSE
          else {
             console.log("      🗑️ REMOVING JUNK: " + fileName + " (" + fileType + ")");
             try {
               folder.removeFile(file);
             } catch(e) {
               console.error("      ❌ Failed to remove junk file: " + e.message);
             }
          }
        }
        
        // D. WRITE TO SPREADSHEET
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
