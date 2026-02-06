// --- BACKGROUND JOB: RUNS HOURLY ---
function runJanitor() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Breeders");
    
    // 1. READ DATA
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    // 2. DYNAMICALLY FIND COLUMNS (So moving columns doesn't break code)
    // Helper to normalize headers like your doGet does
    var getColIndex = function(name) {
      for (var i = 0; i < headers.length; i++) {
        if (headers[i].toString().toLowerCase().trim().replace(/ /g, "_") === name) return i;
      }
      return -1;
    };
    
    var folderIdIndex = getColIndex("gallery_folder_id");
    var cacheIndex = getColIndex("image_cache_json");
    var nameIndex = getColIndex("name");
    
    // Safety Check
    if (folderIdIndex === -1 || cacheIndex === -1) {
      Logger.log("❌ ERROR: Could not find 'gallery_folder_id' or 'image_cache_json' columns.");
      return;
    }
  
    Logger.log("Starting Image Manger Run... (Folder Col: " + folderIdIndex + ", Cache Col: " + cacheIndex + ")");
  
    // 3. LOOP THROUGH EACH BREEDER
    for (var i = 1; i < data.length; i++) {
      var folderId = data[i][folderIdIndex];
      var farmName = data[i][nameIndex];
      
      // A. IF NO FOLDER, CLEAR CACHE
      if (!folderId || folderId === "") {
        // Only clear if it isn't already empty (saves write quota)
        if (data[i][cacheIndex] !== "") {
          sheet.getRange(i + 1, cacheIndex + 1).setValue("");
        }
        continue;
      }
  
      try {
        var folder = DriveApp.getFolderById(folderId);
        var files = folder.getFiles();
        var MAX_SIZE = 10 * 1024 * 1024; // 10MB Limit
        
        var imageList = [];
        var logo = null;
        var hasChanges = false; // logic to minimize writes if nothing changed? (Optional, but let's just write to be safe)
        
        while (files.hasNext()) {
          var file = files.next();
          
          // B. DELETE OVERSIZE FILES
          if (file.getSize() > MAX_SIZE) {
            Logger.log("🗑️ Deleting oversize file in " + farmName + ": " + file.getName());
            file.setTrashed(true);
            continue;
          }
          
          // C. PROCESS IMAGES
          if (file.getMimeType().indexOf('image') > -1) {
             
             // Ensure Public Permission
             if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
               file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
             }
             
             // Generate Fast Link
             // "s1600" gets the full resolution, "w800" limits width to 800px (good for galleries)
             var rawUrl = "https://lh3.googleusercontent.com/d/" + file.getId() + "=w800";
             
             // Simple Base64 Encode (to match your obfuscation style)
             var encoded = Utilities.base64Encode(rawUrl);
             
             // Sort: Logo vs Gallery
             if (file.getName().toLowerCase().indexOf('logo') > -1) {
               logo = encoded;
             } else {
               imageList.push(encoded);
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
        if (data[i][cacheIndex] !== newJson) {
           sheet.getRange(i + 1, cacheIndex + 1).setValue(newJson);
           Logger.log("✅ Updated cache for: " + farmName);
        }
        
      } catch (e) {
        Logger.log("⚠️ Error processing " + farmName + ": " + e);
      }
    }
    
    Logger.log("Janitor Run Complete.");
  }