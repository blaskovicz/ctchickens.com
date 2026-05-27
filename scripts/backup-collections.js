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
import { getAuth } from 'firebase-admin/auth';
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

async function exportAuthUsers() {
  console.log('Fetching auth users...');
  const auth = getAuth();
  const users = {};
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    result.users.forEach(u => {
      users[u.uid] = {
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        photoURL: u.photoURL ?? null,
        emailVerified: u.emailVerified,
        disabled: u.disabled,
        providerData: u.providerData.map(p => ({ providerId: p.providerId, uid: p.uid, email: p.email ?? null })),
        creationTime: u.metadata.creationTime,
        lastSignInTime: u.metadata.lastSignInTime,
      };
    });
    pageToken = result.pageToken;
  } while (pageToken);
  console.log(`  ${Object.keys(users).length} users`);
  return users;
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

  const authData = await exportAuthUsers();
  const authFilename = path.join(backupsDir, `auth_users_${timestamp}.json`);
  fs.writeFileSync(authFilename, JSON.stringify(authData, null, 2), 'utf8');
  console.log(`  Saved → ${authFilename}`);

  console.log('\nBackup complete.');
}

main().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
