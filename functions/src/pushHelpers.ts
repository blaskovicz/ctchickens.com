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

  // Only notify participants who:
  //   - are not the literal 'admin' sentinel (admin uses email, not push)
  //   - are not the sender
  //   - have at least one unread message (avoids spurious pings on read threads)
  const recipients = participants.filter(
    (uid: string) => uid !== 'admin' && uid !== senderUid && (unreadCount[uid] ?? 0) > 0
  );
  if (recipients.length === 0) return;

  const preview = text.substring(0, 80);
  const link = `https://ctchickens.com/#/inbox/${threadId}`;

  for (const uid of recipients) {
    const userSnap = await db.collection('users').doc(uid).get();
    const tokens: string[] = userSnap.data()?.fcmTokens ?? [];
    if (tokens.length === 0) continue;

    let response;
    try {
      response = await sendMulticast({
        tokens,
        notification: { title: senderName, body: preview },
        webpush: { fcmOptions: { link } },
      });
    } catch (err) {
      console.error(`[notifyMessageParticipants] sendEachForMulticast failed for uid=${uid}`, err);
      continue;
    }

    // Collect tokens that FCM has invalidated and remove them from Firestore to
    // prevent repeated failed send attempts on subsequent messages.
    const staleTokens = response.responses
      .map((r: any, i: number) =>
        r.error?.code === 'messaging/registration-token-not-registered' ? tokens[i] : null
      )
      .filter(Boolean) as string[];

    if (staleTokens.length > 0) {
      await db.collection('users').doc(uid).update({
        fcmTokens: FieldValue.arrayRemove(...staleTokens),
      });
    }
  }
}
