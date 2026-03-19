/**
 * CT CHICKENS - IMAGE MANAGER & FIRESTORE SYNC (V2)
 * 
 * This script handles:
 * 1. Scanning Google Drive folders for logos and gallery images.
 * 2. Updating the 'Members' spreadsheet with image metadata.
 * 3. Syncing the spreadsheet data to Firestore via REST API.
 * 
 * SETUP:
 * - Add the OAuth2 Library (ID: 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF)
 * - Set Script Properties: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

// --- CONFIGURATION ---
const props = PropertiesService.getScriptProperties();
const FIREBASE_PROJECT_ID = props.getProperty('FIREBASE_PROJECT_ID');
const FIREBASE_CLIENT_EMAIL = props.getProperty('FIREBASE_CLIENT_EMAIL');
const FIREBASE_PRIVATE_KEY = props.getProperty('FIREBASE_PRIVATE_KEY') 
  ? props.getProperty('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n') 
  : null;

/**
 * Initializes the OAuth2 service for Firestore.
 */
function getFirestoreService() {
  if (!FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
    throw new Error("Missing Firebase credentials in Script Properties.");
  }

  return OAuth2.createService('Firestore')
    .setTokenUrl('https://accounts.google.com/o/oauth2/token')
    .setPrivateKey(FIREBASE_PRIVATE_KEY)
    .setIssuer(FIREBASE_CLIENT_EMAIL)
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setScope('https://www.googleapis.com/auth/datastore');
}

/**
 * Converts a plain JS object to the Firestore 'fields' format.
 */
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return { doubleValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(v => toFirestoreValue(v))
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const key in val) {
      fields[key] = toFirestoreValue(val[key]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Slugifies a string for use as a Document ID.
 */
function slugify(text) {
  if (!text) return 'untitled';
  return text.toString().toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           
    .replace(/[^\w\-]+/g, '')       
    .replace(/\-\-+/g, '-')         
    .replace(/^-+/, '')             
    .replace(/-+$/, '');            
}

/**
 * Pushes a single member record to Firestore using PATCH (upsert).
 */
function pushToFirestore(data, slug, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/directory_members/${slug}`;
  
  const payload = {
    fields: toFirestoreValue(data).mapValue.fields
  };

  const options = {
    method: 'PATCH',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error(`Firestore Error (${response.getResponseCode()}): ${response.getContentText()}`);
  }
}

// --- MAIN BACKGROUND JOB ---

function runJanitor() {
    console.log("🧹 JANITOR RUN STARTED at " + new Date().toString());
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Breeders"); 
    
    if (!sheet) {
      console.error("❌ CRITICAL: Could not find 'Breeders' tab.");
      return;
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var getColIndex = function(name) {
      for (var i = 0; i < headers.length; i++) {
        var normalized = headers[i].toString().toLowerCase().trim().replace(/ /g, "_");
        if (normalized === name) return i;
      }
      return -1;
    };
    
    // Define column indices (Updated to match actual sheet headers)
    var folderIdIndex = getColIndex("gallery_folder_id");
    var cacheIndex = getColIndex("image_cache_json");
    var nameIndex = getColIndex("name"); // Sheet uses 'name'
    var typeIndex = getColIndex("category"); // Sheet uses 'category', not 'member_type'
    var townIndex = getColIndex("location"); // Sheet uses 'location', not 'town'
    var emailIndex = getColIndex("contact_link"); // Sheet uses 'contact_link'
    var websiteIndex = getColIndex("info_link"); // Sheet uses 'info_link'
    var descIndex = getColIndex("selling"); // Sheet uses 'selling'
    var tagsIndex = getColIndex("search_tags"); // If you don't have this column yet, it will safely default to empty
    var uidIndex = getColIndex("owner_uid");
    var statusIndex = getColIndex("status");
    var verifiedIndex = getColIndex("verified"); // Sheet uses 'verified', not 'is_verified'
    var foundingIndex = getColIndex("founding_breeder"); // Sheet uses 'founding_breeder'
    var dateIndex = getColIndex("updated"); // Sheet uses 'updated', not 'date_added'
    
    // 1. Authenticate with Firestore
    var service = getFirestoreService();
    var token = service.hasAccess() ? service.getAccessToken() : null;
    if (!token) {
      console.error("❌ Firestore Authentication Failed: " + service.getLastError());
      return;
    }

    var updatedCount = 0;
    var errorCount = 0;
  
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var farmName = (nameIndex > -1) ? row[nameIndex] : ("Row " + (i + 1));
      var folderId = (folderIdIndex > -1) ? row[folderIdIndex] : null;
      var currentCache = (cacheIndex > -1) ? row[cacheIndex] : "";
      
      try {
        var logoUrl = "";
        var galleryUrls = [];

        // A. SCAN GOOGLE DRIVE FOR IMAGES
        if (folderId && folderId !== "") {
          console.log("🔍 Scanning Drive: [" + farmName + "] (" + folderId + ")");
          var folder = DriveApp.getFolderById(folderId);
          
          var fileIterator = folder.getFiles();
          var allFiles = [];
          while (fileIterator.hasNext()) allFiles.push(fileIterator.next());

          allFiles.sort((a, b) => b.getLastUpdated().getTime() - a.getLastUpdated().getTime());

          var imageList = [];
          var logo = null;
          var galleryCount = 0;
          
          for (var k = 0; k < allFiles.length; k++) {
            var file = allFiles[k];
            var fileName = file.getName();
            var fileType = file.getMimeType();

            if (fileType.indexOf('image') > -1) {
               try {
                 if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
                   file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                 }
               } catch(e) { /* ignore sharing errors */ }
               
               var rawUrl = "https://lh3.googleusercontent.com/d/" + file.getId() + "=w800";
               var encoded = Utilities.base64Encode(rawUrl);
               
               if (fileName.toLowerCase().indexOf('logo') > -1) {
                 logo = encoded;
                 logoUrl = rawUrl;
               } else if (galleryCount < 10) {
                 imageList.push(encoded);
                 galleryUrls.push(rawUrl);
                 galleryCount++;
               }
            }
          }
          
          var newJson = JSON.stringify({ logo: logo, images: imageList });
          if (cacheIndex > -1 && currentCache !== newJson) {
             sheet.getRange(i + 1, cacheIndex + 1).setValue(newJson);
          }
        }

        // B. SYNC TO FIRESTORE
        var memberData = {
          profile: {
            businessName: farmName,
            memberType: (typeIndex > -1 && row[typeIndex]) ? row[typeIndex] : "breeder",
            town: (townIndex > -1) ? row[townIndex] : "",
            contactEmail: (emailIndex > -1 && row[emailIndex]) ? row[emailIndex].toString().replace('mailto:', '') : "",
            website: (websiteIndex > -1) ? row[websiteIndex] : ""
          },
          offerings: {
            description: (descIndex > -1) ? row[descIndex] : "",
            searchTags: (tagsIndex > -1 && row[tagsIndex]) ? row[tagsIndex].toString().split(',').map(s => s.trim()).filter(s => s !== "") : []
          },
          media: {
            logoUrl: logoUrl,
            galleryUrls: galleryUrls
          },
          account: {
            ownerUid: (uidIndex > -1) ? row[uidIndex] : null,
            status: (statusIndex > -1) ? row[statusIndex] : "published",
            isVerified: (verifiedIndex > -1) ? !!row[verifiedIndex] : false,
            foundingMember: (foundingIndex > -1) ? row[foundingIndex] : null,
            updatedAt: (dateIndex > -1 && row[dateIndex]) ? new Date(row[dateIndex]) : new Date()
          }
        };

        var slug = slugify(farmName);
        pushToFirestore(memberData, slug, token);
        updatedCount++;
        
      } catch (e) {
        console.error("❌ ERROR [" + farmName + "]: " + e.message);
        errorCount++;
      }
    }
    
    console.log("🏁 JANITOR RUN COMPLETE. Updated: " + updatedCount + ", Errors: " + errorCount);
}