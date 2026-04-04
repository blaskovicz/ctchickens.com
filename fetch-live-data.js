/**
 * FETCH LIVE DATA SCRIPT (ESM Version)
 */
import fs from 'fs';

const PROJECT_ID = "ct-chickens";
const COLLECTION = "directory_members";
const OUTPUT_FILE = "production-backup.json";

async function downloadPublishedCollection() {
  console.log(`📡 Querying published members from ${PROJECT_ID}...`);
  
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  
  const query = {
    structuredQuery: {
      from: [{ collectionId: COLLECTION }],
      where: {
        fieldFilter: {
          field: { fieldPath: "account.status" },
          op: "EQUAL",
          value: { stringValue: "published" }
        }
      }
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(query)
    });
    
    const results = await response.json();
    
    if (results.error || (results[0] && results[0].error)) {
      console.error("❌ Firestore API Error:", JSON.stringify(results, null, 2));
      return;
    }

    const documents = results
      .filter(item => item.document)
      .map(item => {
        const doc = item.document;
        const slug = doc.name.split('/').pop();
        return {
          id: slug,
          ...parseFirestoreFields(doc.fields)
        };
      });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(documents, null, 2));
    
    console.log(`✅ Success! ${documents.length} published members saved to ${OUTPUT_FILE}`);

  } catch (e) {
    console.error("❌ Connection Error:", e.message);
  }
}

function parseFirestoreFields(fields) {
  const result = {};
  for (const key in fields) {
    const val = fields[key];
    if (val.stringValue !== undefined) result[key] = val.stringValue;
    else if (val.booleanValue !== undefined) result[key] = val.booleanValue;
    else if (val.integerValue !== undefined) result[key] = parseInt(val.integerValue);
    else if (val.doubleValue !== undefined) result[key] = parseFloat(val.doubleValue);
    else if (val.timestampValue !== undefined) result[key] = val.timestampValue;
    else if (val.arrayValue !== undefined) {
      result[key] = (val.arrayValue.values || []).map(v => Object.values(v)[0]);
    }
    else if (val.mapValue !== undefined) {
      result[key] = parseFirestoreFields(val.mapValue.fields);
    }
  }
  return result;
}

downloadPublishedCollection();
