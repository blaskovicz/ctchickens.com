/**
 * Reopens a closed support thread when its owner sends another message.
 *
 * Support threads are one persistent thread per user (`support_{uid}`), not
 * one-off tickets, so closing one in the admin inbox must not be permanent —
 * the next time the owner writes in, it should resurface in the admin queue.
 * Admin replies never reopen a thread; only the owner's own messages do.
 *
 * Extracted from the `onInquiryMessageCreated` trigger so it can be unit-tested
 * without the full firebase-functions runtime (mirrors pushHelpers.ts).
 *
 * @param db - Firestore Admin instance (passed explicitly for testability).
 * @param threadId - The inquiry thread the message was posted to.
 * @param senderUid - The uid of whoever sent the new message.
 * @returns true if the thread was reopened, false otherwise.
 */
export async function maybeReopenSupportThread(
  db: any,
  threadId: string,
  senderUid: string
): Promise<boolean> {
  const threadRef = db.collection('inquiry_threads').doc(threadId);
  const threadSnap = await threadRef.get();
  const thread = threadSnap.data();
  if (!thread) return false;

  if (thread.type !== 'support' || thread.status !== 'closed' || senderUid !== thread.userUid) {
    return false;
  }

  await threadRef.update({ status: 'open' });
  return true;
}
