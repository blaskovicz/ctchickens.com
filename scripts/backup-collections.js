/**
 * backup-collections.js
 *
 * Exports production `directory_members` and `users` Firestore collections
 * to timestamped JSON files in backups/ at the repo root.
 *
 * Usage (run from the repo root):
 *   node scripts/backup-collections.js
 *
 * Auth: uses Application Default Credentials.
 * Run `firebase login` or set GOOGLE_APPLICATION_CREDENTIALS before running.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!getApps().length) {
  initializeApp({ projectId: 'ct-chickens' });
}

const db = getFirestore();

async function exportCollection(collectionName) {
  console.log(`Fetching ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  const docs = {};
  snapshot.forEach(doc => {
    docs[doc.id] = doc.data();
  });
  console.log(`  ${Object.keys(docs).length} documents`);
  return docs;
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const backupsDir = path.join(__dirname, '..', 'backups');

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const collections = ['directory_members', 'users', 'classifieds', 'inquiry_threads'];
  for (const name of collections) {
    const data = await exportCollection(name);
    const filename = path.join(backupsDir, `${name}_${timestamp}.json`);
    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
    console.log(`  Saved → ${filename}`);
  }

  console.log('\nBackup complete.');
}

main().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
