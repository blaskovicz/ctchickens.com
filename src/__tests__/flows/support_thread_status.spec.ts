/**
 * Unit tests for maybeReopenSupportThread (functions/src/threadHelpers.ts).
 *
 * Support threads are one persistent thread per user, so closing one in the
 * admin inbox has to be reversible: the next message from the ticket owner
 * should reopen it automatically, without the client needing write access to
 * the `status` field (it's set here via the Admin SDK, server-side).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { maybeReopenSupportThread } from '../../../functions/src/threadHelpers';

function createMockDb(threadData: Record<string, any> | null) {
  const update = vi.fn().mockResolvedValue(undefined);
  const db = {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: async () => (threadData
          ? { exists: true, data: () => threadData }
          : { exists: false, data: () => undefined }),
        update,
      })),
    })),
  };
  return { db, update };
}

const THREAD_ID = 'support_user-1';
const OWNER_UID = 'user-1';
const ADMIN_UID = 'admin-1';

describe('maybeReopenSupportThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reopens a closed support thread when its owner sends a message', async () => {
    const { db, update } = createMockDb({
      type: 'support',
      status: 'closed',
      userUid: OWNER_UID,
    });

    const result = await maybeReopenSupportThread(db as any, THREAD_ID, OWNER_UID);

    expect(result).toBe(true);
    expect(update).toHaveBeenCalledWith({ status: 'open' });
  });

  it('does not reopen when the admin replies, not the owner', async () => {
    const { db, update } = createMockDb({
      type: 'support',
      status: 'closed',
      userUid: OWNER_UID,
    });

    const result = await maybeReopenSupportThread(db as any, THREAD_ID, ADMIN_UID);

    expect(result).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not touch a thread that is already open', async () => {
    const { db, update } = createMockDb({
      type: 'support',
      status: 'open',
      userUid: OWNER_UID,
    });

    const result = await maybeReopenSupportThread(db as any, THREAD_ID, OWNER_UID);

    expect(result).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not touch a thread with no status field (default-open legacy threads)', async () => {
    const { db, update } = createMockDb({
      type: 'support',
      userUid: OWNER_UID,
    });

    const result = await maybeReopenSupportThread(db as any, THREAD_ID, OWNER_UID);

    expect(result).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('ignores non-support threads even if they somehow carry a closed status', async () => {
    const { db, update } = createMockDb({
      type: 'inquiry',
      status: 'closed',
      userUid: OWNER_UID,
    });

    const result = await maybeReopenSupportThread(db as any, THREAD_ID, OWNER_UID);

    expect(result).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns false without writing when the thread document does not exist', async () => {
    const { db, update } = createMockDb(null);

    const result = await maybeReopenSupportThread(db as any, THREAD_ID, OWNER_UID);

    expect(result).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
