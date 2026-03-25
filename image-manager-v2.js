/**
 * CT CHICKENS - IMAGE MANAGER & FIRESTORE SYNC (V2)
 * 
 * This script handles:
 * 1. Scanning Google Drive folders for logos and gallery images.
 * 2. Updating the 'Members' spreadsheet with image metadata.
 * 3. Syncing data to Firestore with "Owner-Aware" logic.
 * 4. Syncing status BACK to the spreadsheet (sigils).
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
 * Fetches a document from Firestore.
 */
function getFirestoreDoc(slug, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/directory_members/${slug}`;
  const options = {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() === 200) {
    return JSON.parse(response.getContentText());
  }
  return null;
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
 * SMART SLUG LOGIC
 * Removes content in parentheses and sanitizes.
 * Matches the app's generateSlug exactly.
 */
function slugify(name) {
  if (!name) return 'untitled';
  
  // 1. Remove content in parentheses
  var main = name.toString().split('(')[0].trim();
  
  // 2. Sanitize
  return main.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pushToFirestore(data, slug, token, updateMask) {
  let url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/directory_members/${slug}`;
  
  if (updateMask && updateMask.length > 0) {
    const maskParams = updateMask.map(path => `updateMask.fieldPaths=${path}`).join('&');
    url += `?${maskParams}`;
  }

  const payload = {
    fields: toFirestoreValue(data).mapValue.fields
  };

  const options = {
    method: 'PATCH',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
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
    
    var folderIdIndex = getColIndex("gallery_folder_id");
    var cacheIndex = getColIndex("image_cache_json");
    var nameIndex = getColIndex("name"); 
    var typeIndex = getColIndex("category"); 
    var townIndex = getColIndex("location"); 
    var emailIndex = getColIndex("contact_link"); 
    var websiteIndex = getColIndex("info_link"); 
    var descIndex = getColIndex("selling"); 
    var tagsIndex = getColIndex("search_tags"); 
    var uidIndex = getColIndex("owner_uid");
    var statusIndex = getColIndex("status");
    var verifiedIndex = getColIndex("verified"); 
    var foundingIndex = getColIndex("founding_breeder"); 
    var managedIndex = getColIndex("firestore_managed"); 
    
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
      var slug = slugify(farmName);
      
      try {
        var logoUrl = "";
        var galleryUrls = [];

        // 1. DRIVE SCAN
        if (folderId && folderId !== "") {
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
            if (file.getMimeType().indexOf('image') > -1) {
               try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}
               var rawUrl = "https://lh3.googleusercontent.com/d/" + file.getId() + "=w800";
               var encoded = Utilities.base64Encode(rawUrl);
               if (fileName.toLowerCase().indexOf('logo') > -1) {
                 logo = encoded; logoUrl = rawUrl;
               } else if (galleryCount < 10) {
                 imageList.push(encoded); galleryUrls.push(rawUrl); galleryCount++;
               }
            }
          }
          var newJson = JSON.stringify({ logo: logo, images: imageList });
          if (cacheIndex > -1 && currentCache !== newJson) {
             sheet.getRange(i + 1, cacheIndex + 1).setValue(newJson);
          }
        }

        // 2. FIRESTORE SYNC
        var existingDoc = getFirestoreDoc(slug, token);
        var ownerUid = null;
        if (existingDoc && existingDoc.fields.account && existingDoc.fields.account.mapValue.fields.ownerUid) {
          ownerUid = existingDoc.fields.account.mapValue.fields.ownerUid.stringValue || null;
        }

        if (ownerUid) {
          if (managedIndex > -1 && row[managedIndex] !== true) {
            sheet.getRange(i + 1, managedIndex + 1).setValue(true);
          }
          if (uidIndex > -1 && row[uidIndex] !== ownerUid) {
            sheet.getRange(i + 1, uidIndex + 1).setValue(ownerUid);
          }
        }

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
            ownerUid: ownerUid || ((uidIndex > -1) ? row[uidIndex] : null),
            status: (statusIndex > -1 && row[statusIndex]) ? row[statusIndex] : "published",
            isVerified: (verifiedIndex > -1) ? !!row[verifiedIndex] : false,
            foundingMember: (foundingIndex > -1 && row[foundingIndex] !== "") ? parseInt(row[foundingIndex]) : null,
            updatedAt: new Date()
          }
        };

        if (ownerUid) {
          console.log("👤 [" + farmName + "] is CLAIMED. Media sync only.");
          pushToFirestore({ media: memberData.media }, slug, token, ['media.logoUrl', 'media.galleryUrls']);
        } else {
          console.log("🚜 [" + farmName + "] is UNCLAIMED. Full sync.");
          pushToFirestore(memberData, slug, token);
        }
        
        updatedCount++;
      } catch (e) {
        console.error("❌ ERROR [" + farmName + "]: " + e.message);
        errorCount++;
      }
    }
    
    console.log("🏁 JANITOR RUN COMPLETE. Updated: " + updatedCount + ", Errors: " + errorCount);
}