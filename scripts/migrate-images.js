/**
 * One-time migration: Google Drive URLs → Firebase Storage
 *
 * Fetches all claimed directory_members docs whose media.logoUrl or
 * media.galleryUrls contain lh3.googleusercontent.com (Drive) URLs,
 * downloads each image, uploads to profiles/{ownerUid}/{slug}/ in
 * Firebase Storage, and updates the Firestore doc with the new URLs
 * and storage paths.
 *
 * Usage (run from the repo root):
 *   node scripts/migrate-images.js --dry-run                        (inspect only, no writes)
 *   node scripts/migrate-images.js                                  (live run against production)
 *   node scripts/migrate-images.js --slug some-farm                 (single doc)
 *   node scripts/migrate-images.js --slug some-farm --dry-run       (inspect single doc)
 *   node scripts/migrate-images.js --emulator                       (live run against local emulators)
 *   node scripts/migrate-images.js --emulator --dry-run             (inspect against local emulators)
 *
 * Prerequisites (production only):
 *   gcloud auth application-default login
 *   (or set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON)
 *
 * Emulator prerequisites:
 *   npm run emulate  (start emulators in another terminal)
 */

'use strict';

import crypto from 'crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const EMULATOR = process.argv.includes('--emulator');
const slugIndex = process.argv.indexOf('--slug');
const SLUG = slugIndex !== -1 ? process.argv[slugIndex + 1] : null;
const DRIVE_HOST = 'lh3.googleusercontent.com';

const STORAGE_BUCKET = 'ct-chickens.firebasestorage.app';

if (EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
  initializeApp({ projectId: 'ct-chickens', storageBucket: STORAGE_BUCKET });
} else {
  initializeApp({ credential: applicationDefault(), storageBucket: STORAGE_BUCKET });
}

const db = getFirestore();
const bucket = getStorage().bucket();

function isDriveUrl(url) {
  return typeof url === 'string' && url.includes(DRIVE_HOST);
}

async function downloadImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Fetch timed out after 30s for ${url}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

async function uploadToStorage(buffer, contentType, storagePath) {
  const token = crypto.randomUUID();
  const file = bucket.file(storagePath);
  await file.save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('%2F');
  const host = EMULATOR
    ? 'http://127.0.0.1:9199'
    : 'https://firebasestorage.googleapis.com';
  return `${host}/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

async function migrateDoc(snap) {
  const slug = snap.id;
  const data = snap.data();
  const ownerUid = data.account?.ownerUid ?? 'unclaimed';

  if (data.media?.migratedAt && !FORCE) {
    console.log(`  [SKIP] ${slug} — already migrated at ${data.media.migratedAt}`);
    return false;
  }

  const media = data.media || {};
  const logoUrl = media.logoUrl || '';
  const galleryUrls = media.galleryUrls || [];

  const hasDriveLogo = isDriveUrl(logoUrl);
  const driveGalleryIndices = galleryUrls
    .map((u, i) => (isDriveUrl(u) ? i : -1))
    .filter(i => i !== -1);

  if (!hasDriveLogo && driveGalleryIndices.length === 0) {
    console.log(`  [SKIP] ${slug} — no Drive URLs`);
    return false;
  }

  console.log(`\n  [MIGRATE] ${slug} (owner: ${ownerUid === 'unclaimed' ? 'unclaimed' : ownerUid})`);

  let newLogoUrl = logoUrl;
  let newLogoStoragePath = media.logoStoragePath || null;
  const newGalleryUrls = [...galleryUrls];
  const newGalleryStoragePaths = [...(media.galleryStoragePaths || [])];

  while (newGalleryStoragePaths.length < newGalleryUrls.length) {
    newGalleryStoragePaths.push(null);
  }

  const tasks = [];

  if (hasDriveLogo) {
    const storagePath = `profiles/${ownerUid}/${slug}/logo_${crypto.randomUUID()}.jpg`;
    console.log(`    Logo: downloading...`);
    tasks.push(
      downloadImage(logoUrl).then(async ({ buffer, contentType }) => {
        if (!DRY_RUN) {
          newLogoUrl = await uploadToStorage(buffer, contentType, storagePath);
          newLogoStoragePath = storagePath;
          console.log(`    Logo: uploaded → ${storagePath}`);
        } else {
          console.log(`    Logo: [dry-run] would upload to ${storagePath}`);
        }
      })
    );
  }

  for (const idx of driveGalleryIndices) {
    const storagePath = `profiles/${ownerUid}/${slug}/gallery_${crypto.randomUUID()}.jpg`;
    console.log(`    Gallery[${idx}]: downloading...`);
    tasks.push(
      downloadImage(galleryUrls[idx]).then(async ({ buffer, contentType }) => {
        if (!DRY_RUN) {
          newGalleryUrls[idx] = await uploadToStorage(buffer, contentType, storagePath);
          newGalleryStoragePaths[idx] = storagePath;
          console.log(`    Gallery[${idx}]: uploaded → ${storagePath}`);
        } else {
          console.log(`    Gallery[${idx}]: [dry-run] would upload to ${storagePath}`);
        }
      })
    );
  }

  await Promise.all(tasks);

  if (!DRY_RUN) {
    await snap.ref.update({
      'media.logoUrl': newLogoUrl,
      'media.logoStoragePath': newLogoStoragePath,
      'media.galleryUrls': newGalleryUrls,
      'media.galleryStoragePaths': newGalleryStoragePaths,
      'media.migratedAt': new Date().toISOString(),
    });
    console.log(`    Firestore updated.`);
  }

  return true;
}

async function main() {
  console.log(`\nMigrate Images — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${SLUG ? ` [slug: ${SLUG}]` : ''}`);
  console.log('=========================================');

  let migrated = 0;
  let skipped = 0;

  if (SLUG) {
    const docSnap = await db.collection('directory_members').doc(SLUG).get();
    if (!docSnap.exists) {
      console.error(`No directory_members doc found with slug: ${SLUG}`);
      process.exit(1);
    }
    console.log(`Found 1 doc\n`);
    const wasMigrated = await migrateDoc(docSnap);
    if (wasMigrated) migrated++;
    else skipped++;
  } else {
    const snap = await db.collection('directory_members').get();
    console.log(`Found ${snap.size} directory_members docs\n`);
    for (const docSnap of snap.docs) {
      const wasMigrated = await migrateDoc(docSnap);
      if (wasMigrated) migrated++;
      else skipped++;
    }
  }

  console.log(`\n=========================================`);
  console.log(`Done. Migrated: ${migrated}, Skipped: ${skipped}`);
  if (DRY_RUN) console.log('(Dry run — no writes were made)');
}

main().catch(e => {
  console.error('\n[FATAL]', e.message);
  process.exit(1);
});
