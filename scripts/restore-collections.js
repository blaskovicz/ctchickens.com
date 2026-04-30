/**
 * restore-collections.js
 *
 * Restores Firestore collections from JSON backups created by backup-collections.js.
 * Works against both the local emulator (for seeding) and production (for disaster recovery).
 *
 * Usage:
 *   # Seed emulator from latest backups (auto-picks most recent file per collection)
 *   node scripts/restore-collections.js --emulator
 *
 *   # Seed emulator from a specific file
 *   node scripts/restore-collections.js --emulator --file backups/directory_members_2026-04-30_12-00-00.json
 *
 *   # Restore a specific file to production (requires --confirm)
 *   node scripts/restore-collections.js --file backups/directory_members_2026-04-30_12-00-00.json --confirm
 *
 * The collection name is inferred from the filename prefix (e.g. "directory_members_...json" → directory_members).
 * Known collections: directory_members, users
 *
 * Auth (production only): uses Application Default Credentials.
 * Run `firebase login` or set GOOGLE_APPLICATION_CREDENTIALS before running.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const EMULATOR = args.includes('--emulator');
const CONFIRM = args.includes('--confirm');
const fileIndex = args.indexOf('--file');
const SPECIFIC_FILE = fileIndex !== -1 ? args[fileIndex + 1] : null;

const KNOWN_COLLECTIONS = ['directory_members', 'users', 'classifieds'];
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

// ---------------------------------------------------------------------------
// Safety guard
// ---------------------------------------------------------------------------
if (!EMULATOR && !CONFIRM) {
  console.error('ERROR: Restoring to production requires --confirm to prevent accidental overwrites.');
  console.error('  node scripts/restore-collections.js --file <path> --confirm');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Init Firebase
// ---------------------------------------------------------------------------
if (EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

if (!getApps().length) {
  initializeApp({ projectId: 'ct-chickens' });
}

const db = getFirestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Infers the Firestore collection name from the backup filename.
 * e.g. "directory_members_2026-04-30_12-00-00.json" → "directory_members"
 */
function inferCollection(filename) {
  const base = path.basename(filename);
  for (const col of KNOWN_COLLECTIONS) {
    if (base.startsWith(col + '_')) return col;
  }
  throw new Error(`Cannot infer collection from filename: ${base}. Expected prefix: ${KNOWN_COLLECTIONS.join(' or ')}`);
}

/**
 * Finds the most recent backup file for a given collection in backups/.
 */
function latestBackup(collection) {
  if (!fs.existsSync(BACKUPS_DIR)) {
    throw new Error(`backups/ directory not found. Run backup-collections.js first.`);
  }
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith(collection + '_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error(`No backup files found for collection "${collection}" in backups/`);
  }
  return path.join(BACKUPS_DIR, files[0]);
}

/**
 * Restores a single backup file to Firestore using batched writes (max 500 ops/batch).
 */
async function restoreFile(filePath) {
  const collection = inferCollection(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const docs = JSON.parse(raw);
  const entries = Object.entries(docs);

  console.log(`\nRestoring ${entries.length} docs → ${collection} (${path.basename(filePath)})`);

  const BATCH_SIZE = 500;
  let written = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const [id, data] of chunk) {
      batch.set(db.collection(collection).doc(id), data);
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  ${written}/${entries.length} written...`);
  }

  console.log(`  ✓ Done`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const mode = EMULATOR ? 'EMULATOR' : 'PRODUCTION';
  console.log(`\nRestore Collections — ${mode}`);
  console.log('=========================================');

  if (SPECIFIC_FILE) {
    // Single file mode
    await restoreFile(SPECIFIC_FILE);
  } else if (EMULATOR) {
    // Auto-seed mode: restore latest backup for every known collection
    for (const collection of KNOWN_COLLECTIONS) {
      try {
        const file = latestBackup(collection);
        await restoreFile(file);
      } catch (e) {
        console.warn(`  [SKIP] ${collection}: ${e.message}`);
      }
    }
  } else {
    console.error('ERROR: --file is required when restoring to production.');
    process.exit(1);
  }

  console.log('\n✓ Restore complete.');
}

main().catch(e => {
  console.error('\n[FATAL]', e.message);
  process.exit(1);
});
