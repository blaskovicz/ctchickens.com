import { FieldValue } from 'firebase-admin/firestore';

// Minimal FCM multicast types — mirrors firebase-admin/messaging without importing it,
// so the function is testable without needing a real Firebase Admin app initialisation.
type MulticastMessage = {
  tokens: string[];
  notification: { title: string; body: string };
  webpush: { fcmOptions: { link: string } };
};

type SendMulticastFn = (message: MulticastMessage) => Promise<{
  responses: Array<{ success: boolean; error?: { code: string } | null }>;
}>;

// FCM error codes that mean the token will never succeed again — safe to prune
// immediately instead of retrying (and failing) on every future message.
// https://firebase.google.com/docs/cloud-messaging/send-message#admin_sdk_errors
const UNREGISTERABLE_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
  'messaging/mismatched-credential',
]);

/**
 * Sends FCM push notifications to all thread participants who have unread messages,
 * excluding the message sender and the literal 'admin' participant.
 * Automatically removes stale FCM tokens that are no longer registered.
 *
 * Extracted from the Firestore trigger so it can be unit-tested without the full
 * firebase-functions runtime (analogous to emailHelpers.ts for email logic).
 *
 * `sendMulticast` is injected by the caller so tests can pass a vi.fn() without
 * needing to mock firebase-admin — the Admin SDK lives in functions/node_modules/
 * which vitest resolves separately from the root node_modules.
 *
 * @param db - Firestore Admin instance (passed explicitly for testability).
 * @param threadId - The parent inquiry thread ID.
 * @param messageData - Fields from the new message document.
 * @param sendMulticast - FCM multicast sender (pass getMessaging().sendEachForMulticast in prod).
 */
export async function notifyMessageParticipants(
  db: any,
  threadId: string,
  messageData: {
    senderUid: string;
    text?: string;
    senderName?: string;
  },
  sendMulticast: SendMulticastFn
): Promise<void> {
  const { senderUid, text = '', senderName = 'Someone' } = messageData;

  const threadSnap = await db.collection('inquiry_threads').doc(threadId).get();
  const thread = threadSnap.data();
  if (!thread) return;

  const participants: string[] = thread.participants || [];
  const unreadCount: Record<string, number> = thread.unreadCount || {};

  // Mirrors the recipient rule in sweepUnreadThreadNotifications (index.ts) — the
  // two notification channels must agree on who "has unread messages to be notified
  // about" for the same thread:
  //   - never the literal 'admin' sentinel (admin uses email, not push)
  //   - never the sender
  //   - on support threads, only the thread owner gets notified, not other admins
  //   - must have at least one unread message (avoids spurious pings on read threads)
  const recipients = participants.filter((uid: string) => {
    if (uid === 'admin' || uid === senderUid) return false;
    if (thread.type === 'support' && uid !== thread.userUid) return false;
    return (unreadCount[uid] ?? 0) > 0;
  });
  if (recipients.length === 0) return;

  const preview = text.substring(0, 80);
  const link = `https://ctchickens.com/#/inbox/${threadId}`;

  // Each recipient is handled independently — one recipient's Firestore read or
  // FCM send failing must never block or delay any other recipient.
  await Promise.all(
    recipients.map(async (uid) => {
      try {
        const userSnap = await db.collection('users').doc(uid).get();
        const tokens: string[] = userSnap.data()?.fcmTokens ?? [];
        if (tokens.length === 0) return;

        const response = await sendMulticast({
          tokens,
          notification: { title: senderName, body: preview },
          webpush: { fcmOptions: { link } },
        });

        // Collect tokens that FCM has permanently invalidated and remove them from
        // Firestore to prevent repeated failed send attempts on subsequent messages.
        const staleTokens = response.responses
          .map((r: any, i: number) =>
            r.error?.code && UNREGISTERABLE_ERROR_CODES.has(r.error.code) ? tokens[i] : null
          )
          .filter(Boolean) as string[];

        if (staleTokens.length > 0) {
          await db.collection('users').doc(uid).update({
            fcmTokens: FieldValue.arrayRemove(...staleTokens),
          });
        }
      } catch (err) {
        console.error(`[notifyMessageParticipants] failed for uid=${uid}`, err);
      }
    })
  );
}
