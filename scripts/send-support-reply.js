/**
 * send-support-reply.js
 *
 * Sends an admin reply into a user's support thread (inquiry_threads/support_{uid}),
 * replicating the exact transaction InboxView.vue's handleSend() uses for an
 * existing thread — one atomic write that creates the message AND updates the
 * thread's lastMessage/updatedAt/unreadCount together. Writing those separately
 * is what causes a reply to "look wrong": the message bubble's side/color in the
 * UI is relative to whichever admin account is currently viewing it
 * (msg.senderUid === the logged-in user's own uid), so sending as the wrong
 * admin identity makes your own reply render as if it came from the customer.
 *
 * Usage (run from the repo root):
 *   node scripts/send-support-reply.js --uid <userUid> --as zach --text "..." --dry-run
 *   node scripts/send-support-reply.js --uid <userUid> --as zach --text "..."
 *
 * --as accepts a known alias (zach, carly) or a raw admin uid — either way it's
 * verified against users/{uid}.isAdmin before anything is written.
 *
 * Auth: uses Application Default Credentials.
 * Run `firebase login` and `gcloud auth application-default login` before running.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ADMIN_ALIASES = {
  zach: 'st2MYXa1ypNCkvUjjB3My9Fer3v2',
  carly: 'TaulD757bxaUW37vk2TqBgE2ZtC3',
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const USER_UID = getArg('--uid');
const AS = getArg('--as');
const TEXT = getArg('--text');

if (!USER_UID || !AS || !TEXT) {
  console.error('Usage: node scripts/send-support-reply.js --uid <userUid> --as <zach|carly|uid> --text "..." [--dry-run]');
  process.exit(1);
}

const ADMIN_UID = ADMIN_ALIASES[AS] || AS;

if (!getApps().length) {
  initializeApp({ projectId: 'ct-chickens' });
}

const db = getFirestore();

async function main() {
  if (DRY_RUN) console.log('[dry-run] No writes will be made.\n');

  const adminSnap = await db.collection('users').doc(ADMIN_UID).get();
  if (!adminSnap.exists || adminSnap.data().isAdmin !== true) {
    console.error(`Aborting: ${ADMIN_UID} is not a known admin user (users/${ADMIN_UID}.isAdmin !== true).`);
    process.exit(1);
  }
  console.log(`Sending as: ${adminSnap.data().displayName} (${ADMIN_UID})`);

  const threadId = `support_${USER_UID}`;
  const threadRef = db.collection('inquiry_threads').doc(threadId);
  const threadSnap = await threadRef.get();

  if (!threadSnap.exists) {
    console.error(`Aborting: ${threadId} does not exist.`);
    process.exit(1);
  }
  const thread = threadSnap.data();
  if (thread.type !== 'support' || thread.userUid !== USER_UID) {
    console.error(`Aborting: ${threadId} does not look like a support thread for ${USER_UID} (type=${thread.type}, userUid=${thread.userUid}).`);
    process.exit(1);
  }

  const lastMessage = TEXT.substring(0, 50) + (TEXT.length > 50 ? '...' : '');
  const currentUnread = thread.unreadCount?.[USER_UID] || 0;

  console.log(`Thread: ${threadId} (user: ${thread.userName || USER_UID})`);
  console.log(`Message: ${TEXT}`);
  console.log(`  lastMessage preview: "${lastMessage}"`);
  console.log(`  unreadCount.${USER_UID}: ${currentUnread} -> ${currentUnread + 1}`);

  if (DRY_RUN) {
    console.log('\n[dry-run] Would write the message + thread update atomically.');
    return;
  }

  await db.runTransaction(async (transaction) => {
    const freshThreadSnap = await transaction.get(threadRef);
    const freshUnread = freshThreadSnap.data()?.unreadCount?.[USER_UID] || 0;

    transaction.update(threadRef, {
      lastMessage,
      updatedAt: FieldValue.serverTimestamp(),
      [`unreadCount.${USER_UID}`]: freshUnread + 1,
    });

    const newMessageRef = threadRef.collection('messages').doc();
    transaction.set(newMessageRef, {
      senderUid: ADMIN_UID,
      text: TEXT,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    });
  });

  console.log('\nReply sent.');
}

main().catch((e) => {
  console.error('Send failed:', e);
  process.exit(1);
});
