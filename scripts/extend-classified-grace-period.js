/**
 * extend-classified-grace-period.js
 *
 * Extends expires_at on active classifieds to now + <days>.
 * Optionally resets renewal_count to 0.
 *
 * Usage (run from repo root):
 *   node scripts/extend-classified-grace-period.js --days=30
 *   node scripts/extend-classified-grace-period.js --days=30 --reset-renewals
 *   node scripts/extend-classified-grace-period.js --id=<classifiedId> --days=30 --reset-renewals
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ projectId: 'ct-chickens' });
}

const db = getFirestore();

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const classifiedId = args['id'] ?? null;
const days = parseFloat(args['days']);
const resetRenewals = args['reset-renewals'] === true || args['reset-renewals'] === 'true';

if (!days || isNaN(days) || days <= 0) {
  console.error('Error: --days=<number> is required and must be positive.');
  process.exit(1);
}

const newExpiresAt = Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

async function run() {
  let docs = [];

  if (classifiedId) {
    const snap = await db.collection('classifieds').doc(classifiedId).get();
    if (!snap.exists) {
      console.error(`No classified found with id: ${classifiedId}`);
      process.exit(1);
    }
    docs = [snap];
  } else {
    const snap = await db.collection('classifieds').where('status', '==', 'active').get();
    docs = snap.docs;
  }

  if (docs.length === 0) {
    console.log('No active classifieds found.');
    return;
  }

  console.log(`\nClassifieds to update (${docs.length}):`);
  docs.forEach(d => {
    const old = d.data().expires_at?.toDate().toISOString().slice(0, 10) ?? 'unknown';
    console.log(`  ${d.id} — "${d.data().title}" — current expiry: ${old}`);
  });
  console.log(`\nNew expiry: ${newExpiresAt.toDate().toISOString().slice(0, 10)} (now + ${days} days)`);
  if (resetRenewals) console.log('Renewals will be reset to 0.');
  console.log('\nProceed? (ctrl+c to cancel, enter to continue)');

  await new Promise(resolve => process.stdin.once('data', resolve));
  process.stdin.destroy();

  const batch = db.batch();
  docs.forEach(d => {
    const update = { expires_at: newExpiresAt, expiry_warning_sent: false };
    if (resetRenewals) update.renewal_count = 0;
    batch.update(d.ref, update);
  });
  await batch.commit();

  console.log(`Done. Updated ${docs.length} classified(s).`);
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
