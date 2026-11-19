/**
 * read-support-threads.js
 *
 * Read-only: lists support threads (inquiry_threads where type == 'support')
 * and prints their messages, newest thread first.
 *
 * Usage (run from the repo root):
 *   node scripts/read-support-threads.js                # all support threads
 *   node scripts/read-support-threads.js --uid <uid>     # one user's thread only
 *   node scripts/read-support-threads.js --limit 5       # cap number of threads
 *
 * Auth: uses Application Default Credentials.
 * Run `firebase login` or set GOOGLE_APPLICATION_CREDENTIALS before running.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const uidIndex = args.indexOf('--uid');
const TARGET_UID = uidIndex !== -1 ? args[uidIndex + 1] : null;
const limitIndex = args.indexOf('--limit');
const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

if (!getApps().length) {
  initializeApp({ projectId: 'ct-chickens' });
}

const db = getFirestore();

function formatTimestamp(ts) {
  if (!ts) return '(no timestamp)';
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  return String(ts);
}

async function main() {
  let query = db.collection('inquiry_threads').where('type', '==', 'support');
  if (TARGET_UID) {
    query = query.where('userUid', '==', TARGET_UID);
  }
  query = query.orderBy('updatedAt', 'desc');
  if (LIMIT) {
    query = query.limit(LIMIT);
  }

  const threadsSnap = await query.get();

  if (threadsSnap.empty) {
    console.log('No support threads found.');
    return;
  }

  console.log(`Found ${threadsSnap.size} support thread(s):\n`);

  for (const threadDoc of threadsSnap.docs) {
    const thread = threadDoc.data();
    console.log('='.repeat(60));
    console.log(`Thread: ${threadDoc.id}`);
    console.log(`  userUid:      ${thread.userUid}`);
    console.log(`  userName:     ${thread.userName ?? '(unknown)'}`);
    console.log(`  lastMessage:  ${thread.lastMessage ?? ''}`);
    console.log(`  updatedAt:    ${formatTimestamp(thread.updatedAt)}`);
    console.log(`  unreadCount:  ${JSON.stringify(thread.unreadCount ?? {})}`);

    const messagesSnap = await threadDoc.ref
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();

    console.log(`  Messages (${messagesSnap.size}):`);
    messagesSnap.forEach((msgDoc) => {
      const msg = msgDoc.data();
      const flag = msg.adminReviewStatus && msg.adminReviewStatus !== 'approved'
        ? ` [${msg.adminReviewStatus}]`
        : '';
      console.log(`    [${formatTimestamp(msg.createdAt)}] ${msg.senderUid}${flag}: ${msg.text}`);
    });
    console.log('');
  }
}

main().catch((e) => {
  console.error('Failed to read support threads:', e);
  process.exit(1);
});
