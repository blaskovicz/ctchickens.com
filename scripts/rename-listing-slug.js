/**
 * rename-listing-slug.js
 *
 * Renames a published directory_members listing's slug (Firestore doc ID)
 * and/or business name. Firestore doc IDs can't be renamed in place, so this
 * copies the doc to the new slug, updates businessName, fixes up breederSlug/
 * breederName on the owner's existing inquiry_threads, then deletes the old
 * doc. Storage files are left untouched — sweepExpiredFarmImages matches by
 * literal path string in media.logoStoragePath/galleryStoragePaths, not by
 * folder-name-vs-slug, so copying those fields over is sufficient.
 *
 * Safety checks (abort if any fail):
 *   - --from doc must exist and be a published directory_members listing
 *   - --to doc must not already exist
 *   - no draft_profiles/{from} or pending claim_requests/{from} (would need
 *     manual handling — this script doesn't touch them)
 *
 * Usage (run from the repo root):
 *   node scripts/rename-listing-slug.js --from <oldSlug> --to <newSlug> --name "<new businessName>" --dry-run
 *   node scripts/rename-listing-slug.js --from <oldSlug> --to <newSlug> --name "<new businessName>"
 *
 * Auth: uses Application Default Credentials.
 * Run `firebase login` and `gcloud auth application-default login` before running.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const FROM = getArg('--from');
const TO = getArg('--to');
const NEW_NAME = getArg('--name');

if (!FROM || !TO || !NEW_NAME) {
  console.error('Usage: node scripts/rename-listing-slug.js --from <oldSlug> --to <newSlug> --name "<new businessName>" [--dry-run]');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ projectId: 'ct-chickens' });
}

const db = getFirestore();

async function main() {
  if (DRY_RUN) console.log('[dry-run] No writes will be made.\n');

  const fromRef = db.collection('directory_members').doc(FROM);
  const toRef = db.collection('directory_members').doc(TO);

  const [fromSnap, toSnap, draftSnap, claimSnap] = await Promise.all([
    fromRef.get(),
    toRef.get(),
    db.collection('draft_profiles').doc(FROM).get(),
    db.collection('claim_requests').doc(FROM).get(),
  ]);

  if (!fromSnap.exists) {
    console.error(`Aborting: directory_members/${FROM} does not exist.`);
    process.exit(1);
  }
  if (toSnap.exists) {
    console.error(`Aborting: directory_members/${TO} already exists — pick a different --to slug.`);
    process.exit(1);
  }
  if (draftSnap.exists) {
    console.error(`Aborting: draft_profiles/${FROM} exists — resolve that draft before renaming.`);
    process.exit(1);
  }
  if (claimSnap.exists && claimSnap.data().status === 'pending') {
    console.error(`Aborting: a pending claim_requests/${FROM} exists — resolve it before renaming.`);
    process.exit(1);
  }

  const oldData = fromSnap.data();
  const newData = {
    ...oldData,
    profile: { ...oldData.profile, businessName: NEW_NAME },
  };

  console.log(`Renaming directory_members/${FROM} -> directory_members/${TO}`);
  console.log(`  businessName: "${oldData.profile.businessName}" -> "${NEW_NAME}"`);

  const threadsSnap = await db.collection('inquiry_threads').where('breederSlug', '==', FROM).get();
  console.log(`  inquiry_threads to update: ${threadsSnap.size}`);
  threadsSnap.forEach((d) => console.log(`    ${d.id}`));

  if (DRY_RUN) {
    console.log('\n[dry-run] Would back up old doc, write new doc, update threads above, then delete old doc.');
    return;
  }

  // Backup before any writes
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const backupFile = path.join(backupsDir, `rename_${FROM}_to_${TO}_${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ slug: FROM, data: oldData }, null, 2), 'utf8');
  console.log(`  Backup saved -> ${backupFile}`);

  await toRef.set(newData);
  console.log(`  Created directory_members/${TO}`);

  const batch = db.batch();
  threadsSnap.forEach((d) => {
    batch.update(d.ref, { breederSlug: TO, breederName: NEW_NAME });
  });
  if (threadsSnap.size > 0) {
    await batch.commit();
    console.log(`  Updated ${threadsSnap.size} inquiry_threads`);
  }

  await fromRef.delete();
  console.log(`  Deleted directory_members/${FROM}`);

  console.log('\nRename complete.');
}

main().catch((e) => {
  console.error('Rename failed:', e);
  process.exit(1);
});
