/**
 * SEED EMULATOR SCRIPT (Admin Version)
 */
import fs from 'fs';

// load from .firebaserc
const firebaserc = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));

const LOCAL_PROJECT_ID = firebaserc.projects.default;
if (!LOCAL_PROJECT_ID) {  
  throw new Error("no project id specified in .firebaserc")
}
console.log(`🌱 Seeding ${LOCAL_PROJECT_ID}...`);
const COLLECTION = "directory_members";
const INPUT_FILE = "production-backup.json";

async function seedLocalDatabase() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Error: ${INPUT_FILE} not found. Run 'node fetch-live-data.js' first.`);
    return;
  }

  const rawData = fs.readFileSync(INPUT_FILE);
  const documents = JSON.parse(rawData);

  console.log(`🌱 Seeding ${documents.length} records into local emulator...`);

  for (const doc of documents) {
    const { id, ...fields } = doc;
    const url = `http://127.0.0.1:8080/v1/projects/${LOCAL_PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${id}`;

    try {
      const payload = {
        fields: toFirestoreValue(fields).mapValue.fields
      };

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          // THIS IS THE KEY: Tells the emulator to bypass security rules
          'Authorization': 'Bearer owner' 
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`✅ Seeded: ${id}`);
      } else {
        const err = await response.json();
        console.error(`❌ Failed ${id}:`, err.error ? err.error.message : err);
      }
    } catch (e) {
      console.error(`❌ Network error for ${id}:`, e.message);
    }
  }

  console.log("\n✨ Seeding Complete!");
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return { doubleValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(v => toFirestoreValue(v)) } };
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

seedLocalDatabase();
