import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Hoisted mock variables ---
// vi.mock factories are hoisted before variable declarations, so any variables
// referenced inside them must be created with vi.hoisted().

const { mockUpdateDoc, mockDoc, mockArrayUnion, mockArrayRemove } = vi.hoisted(() => ({
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockArrayUnion: vi.fn((...args: any[]) => ({ _type: 'arrayUnion', args })),
  mockArrayRemove: vi.fn((...args: any[]) => ({ _type: 'arrayRemove', args })),
}));

const { mockGetToken, mockDeleteToken } = vi.hoisted(() => ({
  mockGetToken: vi.fn().mockResolvedValue('fcm-token-abc'),
  mockDeleteToken: vi.fn().mockResolvedValue(undefined),
}));

// --- Module mocks ---

vi.mock('../../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid-123' } },
  messaging: { _fake: true /* truthy — bypasses the !messaging guard */ },
  VAPID_KEY: 'test-vapid-key',
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  updateDoc: mockUpdateDoc,
  arrayUnion: mockArrayUnion,
  arrayRemove: mockArrayRemove,
}));

vi.mock('firebase/messaging', () => ({
  getToken: mockGetToken,
  deleteToken: mockDeleteToken,
}));

import { useNotifications } from '../useNotifications';

// ---------------------------------------------------------------------------

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('fcm-token-abc');

    // Default: permission is promptable and the user grants it.
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    // PushManager just needs to be truthy to pass the guard.
    vi.stubGlobal('PushManager', {});
  });

  // -------------------------------------------------------------------------
  // requestPermission
  // -------------------------------------------------------------------------

  describe('requestPermission', () => {
    it('writes arrayUnion(token) to users/{uid} when permission is granted', async () => {
      const { requestPermission } = useNotifications();
      await requestPermission();

      expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'test-uid-123');
      expect(mockUpdateDoc).toHaveBeenCalledOnce();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        { fcmTokens: expect.objectContaining({ _type: 'arrayUnion', args: ['fcm-token-abc'] }) }
      );
    });

    it('does NOT write to Firestore when permission is denied', async () => {
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('denied'),
      });

      const { requestPermission } = useNotifications();
      await requestPermission();

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('fails silently when Notification API is absent (old browser / test env)', async () => {
      vi.stubGlobal('Notification', undefined);

      const { requestPermission } = useNotifications();
      await expect(requestPermission()).resolves.toBeUndefined();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('fails silently when PushManager is absent (non-push browser)', async () => {
      vi.stubGlobal('PushManager', undefined);

      const { requestPermission } = useNotifications();
      await expect(requestPermission()).resolves.toBeUndefined();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('fails silently when getToken throws (e.g. SW not registered yet)', async () => {
      mockGetToken.mockRejectedValueOnce(new Error('SW not registered'));

      const { requestPermission } = useNotifications();
      await expect(requestPermission()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // revokeToken
  // -------------------------------------------------------------------------

  describe('revokeToken', () => {
    it('calls deleteToken then writes arrayRemove(token) to users/{uid}', async () => {
      vi.stubGlobal('Notification', {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      });

      const { revokeToken } = useNotifications();
      await revokeToken();

      expect(mockDeleteToken).toHaveBeenCalledOnce();
      expect(mockUpdateDoc).toHaveBeenCalledOnce();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        { fcmTokens: expect.objectContaining({ _type: 'arrayRemove', args: ['fcm-token-abc'] }) }
      );
    });

    it('does nothing when getToken returns null (no registration to revoke)', async () => {
      mockGetToken.mockResolvedValueOnce(null);
      vi.stubGlobal('Notification', {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      });

      const { revokeToken } = useNotifications();
      await revokeToken();

      expect(mockDeleteToken).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('fails silently when Notification API is absent', async () => {
      vi.stubGlobal('Notification', undefined);

      const { revokeToken } = useNotifications();
      await expect(revokeToken()).resolves.toBeUndefined();
      expect(mockDeleteToken).not.toHaveBeenCalled();
    });
  });
});
