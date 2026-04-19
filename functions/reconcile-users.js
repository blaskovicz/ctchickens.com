/**
 * reconcile-users.js
 *
 * Reconciles Firebase Auth records against Firestore `users` docs.
 * - Creates missing `users` docs from Auth data.
 * - Updates stale `email`, `displayName`, `photoURL` fields where they differ.
 *
 * Usage (run from the functions/ directory):
 *   node reconcile-users.js --dry-run          # preview changes, no writes
 *   node reconcile-users.js --uid <uid>        # target a single user
 *   node reconcile-users.js                    # full reconcile
 *
 * Auth: uses Application Default Credentials.
 * Run `firebase login` or set GOOGLE_APPLICATION_CREDENTIALS before running.
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const uidIndex = args.indexOf('--uid');
const TARGET_UID = uidIndex !== -1 ? args[uidIndex + 1] : null;

if (DRY_RUN) console.log('[dry-run] No writes will be made.\n');
if (TARGET_UID) console.log(`[targeting] uid: ${TARGET_UID}\n`);

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
if (!getApps().length) {
  initializeApp({ projectId: 'ct-chickens' });
}

const auth = getAuth();
const db = getFirestore();

// ---------------------------------------------------------------------------
// Reconcile logic
// ---------------------------------------------------------------------------
const TRACKED_FIELDS = ['email', 'displayName', 'photoURL'];

function buildDelta(authUser, firestoreData) {
  const delta = {};
  for (const field of TRACKED_FIELDS) {
    const authVal = authUser[field] ?? null;
    const fsVal = firestoreData ? (firestoreData[field] ?? null) : null;
    if (authVal !== fsVal) {
      delta[field] = authVal;
    }
  }
  return delta;
}

async function processUser(authUser) {
  const uid = authUser.uid;
  const docRef = db.collection('users').doc(uid);
  const snap = await docRef.get();
  const exists = snap.exists;
  const data = exists ? snap.data() : null;

  const delta = buildDelta(authUser, data);

  if (Object.keys(delta).length === 0) {
    return 'skipped';
  }

  const action = exists ? 'updated' : 'created';

  console.log(`[${action}] uid=${uid}`);
  for (const [k, v] of Object.entries(delta)) {
    const old = data?.[k] ?? '(missing)';
    console.log(`  ${k}: ${JSON.stringify(old)} → ${JSON.stringify(v)}`);
  }

  if (!DRY_RUN) {
    await docRef.set(
      { ...delta, lastLogin: data?.lastLogin ?? FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  return action;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let checked = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  if (TARGET_UID) {
    // Single user mode
    let authUser;
    try {
      authUser = await auth.getUser(TARGET_UID);
    } catch (e) {
      console.error(`Failed to fetch Auth user ${TARGET_UID}:`, e.message);
      process.exit(1);
    }

    try {
      const result = await processUser(authUser);
      checked = 1;
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      else skipped++;
    } catch (e) {
      console.error(`Error processing uid=${TARGET_UID}:`, e.message);
      errors++;
    }
  } else {
    // Full reconcile — page through all Auth users
    let pageToken;
    do {
      const listResult = await auth.listUsers(1000, pageToken);
      for (const authUser of listResult.users) {
        checked++;
        try {
          const result = await processUser(authUser);
          if (result === 'created') created++;
          else if (result === 'updated') updated++;
          else skipped++;
        } catch (e) {
          console.error(`Error processing uid=${authUser.uid}:`, e.message);
          errors++;
        }
      }
      pageToken = listResult.pageToken;
    } while (pageToken);
  }

  console.log('\n--- Summary ---');
  console.log(`Checked:  ${checked}`);
  console.log(`Created:  ${created}`);
  console.log(`Updated:  ${updated}`);
  console.log(`Skipped:  ${skipped}`);
  if (errors) console.log(`Errors:   ${errors}`);
  if (DRY_RUN) console.log('\n[dry-run] No writes were made.');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
