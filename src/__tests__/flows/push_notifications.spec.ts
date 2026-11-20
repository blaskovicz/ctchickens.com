/**
 * Unit tests for notifyMessageParticipants (functions/src/pushHelpers.ts).
 *
 * FCM has no local emulator. Rather than mocking firebase-admin/messaging (which
 * lives in functions/node_modules/ and resolves differently from the test runner's
 * root), the function accepts a `sendMulticast` parameter so tests can inject a
 * plain vi.fn() with no SDK ceremony required.
 *
 * firebase-admin/firestore is mocked to supply FieldValue sentinels for asserting
 * on arrayRemove calls without a real Firestore connection.
 *
 * All four scenarios required by the plan are covered:
 *   (a) sendMulticast called with correct tokens and payload
 *   (b) sender is excluded from recipients
 *   (c) users with no tokens or zero unread are skipped
 *   (d) stale tokens (registration-token-not-registered) removed from Firestore
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Provide FieldValue sentinels so we can assert on what was passed to update().
// getFirestore is also mocked because pushHelpers imports from firebase-admin/firestore.
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayRemove: (...args: string[]) => ({ _type: 'arrayRemove', args }),
    arrayUnion: (...args: string[]) => ({ _type: 'arrayUnion', args }),
    serverTimestamp: () => ({ _type: 'serverTimestamp' }),
    increment: (n: number) => ({ _type: 'increment', n }),
    delete: () => ({ _type: 'delete' }),
  },
  getFirestore: vi.fn(),
  Timestamp: { fromDate: vi.fn() },
}));

import { notifyMessageParticipants, sendPushAndPruneStaleTokens, checkTestPushRateLimit } from '../../../functions/src/pushHelpers';

// ---------------------------------------------------------------------------
// Shared mock references
// ---------------------------------------------------------------------------

const mockSendMulticast = vi.fn();
const mockDbUpdate = vi.fn().mockResolvedValue(undefined);

// ---------------------------------------------------------------------------
// Mock Firestore db factory — supports collection/doc/get/update chains.
// ---------------------------------------------------------------------------

function createMockDb(
  threadData: Record<string, any> | null,
  userDataMap: Record<string, Record<string, any> | null>
) {
  return {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (name === 'inquiry_threads') {
            return threadData
              ? { exists: true, data: () => threadData }
              : { exists: false, data: () => undefined };
          }
          if (name === 'users') {
            const userData = userDataMap[id];
            if (userData === undefined) return { exists: false, data: () => undefined };
            return userData !== null
              ? { exists: true, data: () => userData }
              : { exists: false, data: () => undefined };
          }
          return { exists: false, data: () => undefined };
        },
        update: mockDbUpdate,
      }),
    }),
  };
}

// ---------------------------------------------------------------------------

describe('notifyMessageParticipants', () => {
  const SENDER_UID = 'sender-uid';
  const RECIPIENT_UID = 'recipient-uid';
  const THREAD_ID = 'thread-abc-123';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: successful send, no stale tokens.
    mockSendMulticast.mockResolvedValue({
      responses: [{ success: true, error: null }],
    });
    mockDbUpdate.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // (a) Correct tokens and payload sent to FCM
  // -------------------------------------------------------------------------

  it('calls sendMulticast with the recipient tokens and correct notification payload', async () => {
    const db = createMockDb(
      {
        participants: [SENDER_UID, RECIPIENT_UID],
        unreadCount: { [RECIPIENT_UID]: 1 },
      },
      {
        [RECIPIENT_UID]: { fcmTokens: ['token-abc', 'token-def'] },
      }
    );

    await notifyMessageParticipants(
      db as any,
      THREAD_ID,
      { senderUid: SENDER_UID, text: 'Hello there', senderName: 'Alice' },
      mockSendMulticast
    );

    expect(mockSendMulticast).toHaveBeenCalledOnce();
    expect(mockSendMulticast).toHaveBeenCalledWith({
      tokens: ['token-abc', 'token-def'],
      notification: { title: 'Alice', body: 'Hello there' },
      webpush: { fcmOptions: { link: `https://ctchickens.com/#/inbox/${THREAD_ID}` } },
    });
  });

  it('uses "Someone" as the notification title when senderName is absent', async () => {
    const db = createMockDb(
      { participants: [SENDER_UID, RECIPIENT_UID], unreadCount: { [RECIPIENT_UID]: 1 } },
      { [RECIPIENT_UID]: { fcmTokens: ['token-abc'] } }
    );

    await notifyMessageParticipants(
      db as any, THREAD_ID, { senderUid: SENDER_UID, text: 'Hey' }, mockSendMulticast
    );

    expect(mockSendMulticast).toHaveBeenCalledWith(
      expect.objectContaining({ notification: { title: 'Someone', body: 'Hey' } })
    );
  });

  it('truncates message text to 80 characters for the notification body', async () => {
    const longText = 'A'.repeat(100);
    const db = createMockDb(
      { participants: [SENDER_UID, RECIPIENT_UID], unreadCount: { [RECIPIENT_UID]: 1 } },
      { [RECIPIENT_UID]: { fcmTokens: ['token-abc'] } }
    );

    await notifyMessageParticipants(
      db as any, THREAD_ID, { senderUid: SENDER_UID, text: longText }, mockSendMulticast
    );

    expect(mockSendMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: expect.objectContaining({ body: 'A'.repeat(80) }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // (b) Sender is excluded
  // -------------------------------------------------------------------------

  it('does NOT send to the sender even if they appear in participants with unread', async () => {
    mockSendMulticast.mockResolvedValue({
      responses: [{ success: true, error: null }],
    });

    const db = createMockDb(
      {
        // Sender has non-zero unread (edge case)
        participants: [SENDER_UID, RECIPIENT_UID],
        unreadCount: { [SENDER_UID]: 1, [RECIPIENT_UID]: 1 },
      },
      {
        [SENDER_UID]: { fcmTokens: ['sender-token'] },
        [RECIPIENT_UID]: { fcmTokens: ['recipient-token'] },
      }
    );

    await notifyMessageParticipants(
      db as any, THREAD_ID, { senderUid: SENDER_UID, text: 'Hello' }, mockSendMulticast
    );

    expect(mockSendMulticast).toHaveBeenCalledOnce();
    expect(mockSendMulticast).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: ['recipient-token'] })
    );
  });

  // -------------------------------------------------------------------------
  // (c) Users skipped when unread = 0 or no tokens
  // -------------------------------------------------------------------------

  it('skips recipients with unreadCount of 0', async () => {
    const db = createMockDb(
      {
        participants: [SENDER_UID, RECIPIENT_UID],
        unreadCount: { [RECIPIENT_UID]: 0 },
      },
      { [RECIPIENT_UID]: { fcmTokens: ['token-abc'] } }
    );

    await notifyMessageParticipants(
      db as any, THREAD_ID, { senderUid: SENDER_UID, text: 'Hello' }, mockSendMulticast
    );

    expect(mockSendMulticast).not.toHaveBeenCalled();
  });

  it('skips recipients with no FCM tokens registered', async () => {
    const db = createMockDb(
      { participants: [SENDER_UID, RECIPIENT_UID], unreadCount: { [RECIPIENT_UID]: 3 } },
      { [RECIPIENT_UID]: { fcmTokens: [] } }
    );

    await notifyMessageParticipants(
      db as any, THREAD_ID, { senderUid: SENDER_UID, text: 'Hello' }, mockSendMulticast
    );

    expect(mockSendMulticast).not.toHaveBeenCalled();
  });

  it('skips the literal "admin" participant (admin uses email nudge, not push)', async () => {
    mockSendMulticast.mockResolvedValue({
      responses: [{ success: true, error: null }],
    });

    const db = createMockDb(
      {
        participants: [SENDER_UID, 'admin', RECIPIENT_UID],
        unreadCount: { admin: 1, [RECIPIENT_UID]: 1 },
      },
      {
        admin: { fcmTokens: ['admin-token'] },
        [RECIPIENT_UID]: { fcmTokens: ['recipient-token'] },
      }
    );

    await notifyMessageParticipants(
      db as any, THREAD_ID, { senderUid: SENDER_UID, text: 'Hello' }, mockSendMulticast
    );

    // Only the real recipient; admin is filtered out before any Firestore lookup.
    expect(mockSendMulticast).toHaveBeenCalledOnce();
    expect(mockSendMulticast).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: ['recipient-token'] })
    );
  });

  // -------------------------------------------------------------------------
  // (d) Stale token cleanup
  // -------------------------------------------------------------------------

  it('removes stale tokens from Firestore when FCM returns registration-token-not-registered', async () => {
    const staleToken = 'stale-token-xyz';
    const validToken = 'valid-token-abc';

    mockSendMulticast.mockResolvedValue({
      responses: [
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: true, error: null },
      ],
    });

    const db = createMockDb(
      { participants: [SENDER_UID, RECIPIENT_UID], unreadCount: { [RECIPIENT_UID]: 1 } },
      { [RECIPIENT_UID]: { fcmTokens: [staleToken, validToken] } }
    );

    await notifyMessageParticipants(
      db as any, THREAD_ID, { senderUid: SENDER_UID, text: 'Hello' }, mockSendMulticast
    );

    expect(mockDbUpdate).toHaveBeenCalledOnce();
    // firebase-admin/firestore resolves from functions/node_modules/ so the real
    // FieldValue.arrayRemove is called rather than our sentinel mock. We therefore
    // assert on the actual ArrayRemoveTransform structure that firebase-admin produces.
    const [updateArg] = mockDbUpdate.mock.calls[0]!;
    expect(updateArg).toHaveProperty('fcmTokens');
    // Both the real transform (.elements) and any mock sentinel (.args) are checked
    // so the test remains robust across firebase-admin resolution paths.
    const tokenList: string[] = updateArg.fcmTokens?.elements ?? updateArg.fcmTokens?.args ?? [];
    expect(tokenList).toContain(staleToken);
    expect(tokenList).not.toContain(validToken);
  });

  it('does NOT call update when there are no stale tokens', async () => {
    mockSendMulticast.mockResolvedValue({
      responses: [{ success: true, error: null }],
    });

    const db = createMockDb(
      { participants: [SENDER_UID, RECIPIENT_UID], unreadCount: { [RECIPIENT_UID]: 1 } },
      { [RECIPIENT_UID]: { fcmTokens: ['valid-token'] } }
    );

    await notifyMessageParticipants(
      db as any, THREAD_ID, { senderUid: SENDER_UID }, mockSendMulticast
    );

    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('returns early without sending when the thread document does not exist', async () => {
    const db = createMockDb(null, {});

    await notifyMessageParticipants(
      db as any, THREAD_ID, { senderUid: SENDER_UID }, mockSendMulticast
    );

    expect(mockSendMulticast).not.toHaveBeenCalled();
  });

  it('continues to next recipient when sendMulticast throws', async () => {
    const RECIPIENT_2 = 'recipient-2';
    mockSendMulticast
      .mockRejectedValueOnce(new Error('FCM network error'))
      .mockResolvedValueOnce({ responses: [{ success: true, error: null }] });

    const db = createMockDb(
      {
        participants: [SENDER_UID, RECIPIENT_UID, RECIPIENT_2],
        unreadCount: { [RECIPIENT_UID]: 1, [RECIPIENT_2]: 1 },
      },
      {
        [RECIPIENT_UID]: { fcmTokens: ['token-1'] },
        [RECIPIENT_2]: { fcmTokens: ['token-2'] },
      }
    );

    // Must not throw even though the first call rejects.
    await expect(
      notifyMessageParticipants(db as any, THREAD_ID, { senderUid: SENDER_UID }, mockSendMulticast)
    ).resolves.toBeUndefined();

    // Second recipient was still attempted after the first failed.
    expect(mockSendMulticast).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Support-thread recipient exclusion (mirrors sweepUnreadThreadNotifications)
  // -------------------------------------------------------------------------

  it('on support threads, only notifies the thread owner — not other admin-sentinel participants', async () => {
    const ADMIN_UID = 'admin-uid-2';
    const db = createMockDb(
      {
        type: 'support',
        userUid: RECIPIENT_UID,
        participants: [SENDER_UID, RECIPIENT_UID, ADMIN_UID],
        unreadCount: { [RECIPIENT_UID]: 1, [ADMIN_UID]: 1 },
      },
      {
        [RECIPIENT_UID]: { fcmTokens: ['owner-token'] },
        [ADMIN_UID]: { fcmTokens: ['other-admin-token'] },
      }
    );

    await notifyMessageParticipants(
      db as any, THREAD_ID, { senderUid: SENDER_UID, text: 'Hello' }, mockSendMulticast
    );

    expect(mockSendMulticast).toHaveBeenCalledOnce();
    expect(mockSendMulticast).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: ['owner-token'] })
    );
  });
});

// ---------------------------------------------------------------------------
// sendPushAndPruneStaleTokens — the shared helper also used directly by
// sendTestPushNotification (functions/src/index.ts) for the self-test button.
// ---------------------------------------------------------------------------

describe('sendPushAndPruneStaleTokens', () => {
  const UID = 'some-uid';

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMulticast.mockResolvedValue({ responses: [{ success: true, error: null }] });
    mockDbUpdate.mockResolvedValue(undefined);
  });

  it('sends to every registered token and returns the token count', async () => {
    const db = createMockDb(null, { [UID]: { fcmTokens: ['token-a', 'token-b'] } });

    const result = await sendPushAndPruneStaleTokens(
      db as any, UID, { title: 'Test', body: 'Body' }, 'https://ctchickens.com/#/inbox', mockSendMulticast
    );

    expect(result).toEqual({ tokenCount: 2 });
    expect(mockSendMulticast).toHaveBeenCalledWith({
      tokens: ['token-a', 'token-b'],
      notification: { title: 'Test', body: 'Body' },
      webpush: { fcmOptions: { link: 'https://ctchickens.com/#/inbox' } },
    });
  });

  it('returns tokenCount 0 and does not call sendMulticast when the user has no tokens', async () => {
    const db = createMockDb(null, { [UID]: { fcmTokens: [] } });

    const result = await sendPushAndPruneStaleTokens(
      db as any, UID, { title: 'Test', body: 'Body' }, 'https://ctchickens.com/#/inbox', mockSendMulticast
    );

    expect(result).toEqual({ tokenCount: 0 });
    expect(mockSendMulticast).not.toHaveBeenCalled();
  });

  it('prunes a token FCM reports as permanently invalid', async () => {
    mockSendMulticast.mockResolvedValue({
      responses: [{ success: false, error: { code: 'messaging/invalid-registration-token' } }],
    });
    const db = createMockDb(null, { [UID]: { fcmTokens: ['dead-token'] } });

    await sendPushAndPruneStaleTokens(
      db as any, UID, { title: 'Test', body: 'Body' }, 'https://ctchickens.com/#/inbox', mockSendMulticast
    );

    expect(mockDbUpdate).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// checkTestPushRateLimit — pure boundary-math helper behind the 1/min limit
// on sendTestPushNotification. Kept FCM-free so it's trivially unit-testable.
// ---------------------------------------------------------------------------

describe('checkTestPushRateLimit', () => {
  const LIMIT_MS = 60_000;

  it('is never limited on the very first send (no prior timestamp)', () => {
    expect(checkTestPushRateLimit(undefined, Date.now(), LIMIT_MS)).toEqual({
      limited: false,
      waitSeconds: 0,
    });
  });

  it('is limited immediately after a send', () => {
    const now = 1_000_000;
    const result = checkTestPushRateLimit(now, now, LIMIT_MS);
    expect(result.limited).toBe(true);
    expect(result.waitSeconds).toBe(60);
  });

  it('is limited partway through the window, rounding up the remaining wait', () => {
    const now = 1_000_000;
    const lastSentAt = now - 45_000; // 45s elapsed, 15s remain
    const result = checkTestPushRateLimit(lastSentAt, now, LIMIT_MS);
    expect(result.limited).toBe(true);
    expect(result.waitSeconds).toBe(15);
  });

  it('is not limited once the full window has elapsed', () => {
    const now = 1_000_000;
    const lastSentAt = now - LIMIT_MS;
    expect(checkTestPushRateLimit(lastSentAt, now, LIMIT_MS)).toEqual({
      limited: false,
      waitSeconds: 0,
    });
  });

  it('is not limited well past the window', () => {
    const now = 1_000_000;
    const lastSentAt = now - LIMIT_MS * 10;
    expect(checkTestPushRateLimit(lastSentAt, now, LIMIT_MS).limited).toBe(false);
  });
});
