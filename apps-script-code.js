// SHARED SECURITY FUNCTION
function getClientID() {
  var clientID = "CLUCK";
  clientID += "_";
  clientID += "CLUCK";
  clientID += "_";
  clientID += "SECURE";
  clientID += "_";
  clientID += "2026";
  return clientID;
}

function doGet(e) {
  // SECURITY CHECKS
  var origin = e.parameter.origin;
  var allowed = ["https://ctchickens.com", "http://localhost:5173"];
  
  // Check Origin
  if (allowed.indexOf(origin) === -1) {
     return ContentService.createTextOutput(JSON.stringify({ error: "Access Denied: Invalid Origin" }))
       .setMimeType(ContentService.MimeType.JSON);
  }

  // Check Client ID (Handshake)
  var clientID = e.parameter.clientID;
  if (!clientID || clientID !== getClientID()) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Access Denied: Invalid Client ID" }))
       .setMimeType(ContentService.MimeType.JSON);
  }

  // CACHE CHECK
  var cache = CacheService.getScriptCache();
  var cacheKey = "directory_v1_json";
  var cachedJSON = cache.get(cacheKey);
  
  // If we have valid cached data, return it IMMEDIATELY
  // (We skip opening the spreadsheet entirely)
  if (cachedJSON != null && !e.parameter.refresh) {
    return ContentService.createTextOutput(cachedJSON)
      .setMimeType(ContentService.MimeType.JSON);
  }

  // DATA RETRIEVAL (Only runs if security passes)
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get Breeders
  var breederSheet = ss.getSheetByName("Breeders");
  var breederData = breederSheet.getDataRange().getValues();
  var breederHeaders = breederData[0];
  var breederRows = breederData.slice(1);

  // Get Reviews (Safely)
  var reviewSheet = ss.getSheetByName("Reviews");
  var reviewData = [];
  if (reviewSheet && reviewSheet.getLastRow() > 0) {
    reviewData = reviewSheet.getDataRange().getValues();
  }
  
  // Organize Reviews
  var reviewsMap = {};
  if (reviewData.length > 1) {
    var reviewRows = reviewData.slice(1);
    reviewRows.forEach(function(row) {
      var farmName = row[1]; // Col B
      if (!farmName) return;
      var reviewObj = {
        from: row[2] || "Anonymous", // Col C
        type: (row[3] || "Positive").toString().toLowerCase(), // Col D
        comment: row[4] || "", // Col E
        date: row[0] // Col A
      };
      if (!reviewsMap[farmName]) reviewsMap[farmName] = [];
      reviewsMap[farmName].push(reviewObj);
    });
  }

  // Merge Data
  var results = breederRows.map(function(row) {
    var entry = {};
    breederHeaders.forEach(function(header, index) {
      var cleanHeader = header.toString().toLowerCase().trim().replace(/ /g, "_");
      var val = row[index];
      
      // boolean columns
      if (['verified', 'featured'].indexOf(cleanHeader) > -1) {
        val = (val === true || val === 'TRUE' || val === 1);
      }

      // EXPAND CACHE & HIDE RAW DATA ---
      if (cleanHeader === 'image_cache_json') {
        if (val && val !== "") {
          try {
            var cacheObj = JSON.parse(val);
            entry.logo = cacheObj.logo;         // 1. Extract Logo
            entry.images = cacheObj.images || []; // 2. Extract Gallery
          } catch (e) {
            // If parse fails, ignore
          }
        }
        return; // deletes the raw "image_cache_json" from the output
      }

      // --- OBFUSCATION ---
      if ((cleanHeader === 'contact_link' || cleanHeader === 'info_link') && val) {
        // Simple encoding, no salt
        val = Utilities.base64Encode(val.toString());
      }
      // ---------------------------------

      entry[cleanHeader] = val;
    });

    if (!entry.category) entry.category = 'breeder';
    entry.reviews = reviewsMap[entry.name] || []; // Attach reviews

    return entry;
  });

  var finalPayload = { directory_info: results };
  var jsonString = JSON.stringify(finalPayload);
  
  // SAVE TO CACHE
  // Store for 900 seconds (15 minutes). 
  // Maximum allowed by Google is 21600 (6 hours).
  try {
    cache.put(cacheKey, jsonString, 900); 
  } catch (err) {
    // If JSON is too big (100KB+), cache might fail.
    // That's fine, we just proceed without caching.
    Logger.log("Cache save failed (likely too big): " + err);
  }

  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}