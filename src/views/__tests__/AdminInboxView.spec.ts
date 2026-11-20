import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import AdminInboxView from '../AdminInboxView.vue';

// ---------------------------------------------------------------------------
// Firebase mock — AdminInboxView reads everything with one-shot getDocs calls
// keyed by collection/collectionGroup name, so the mock routes on ref.path
// rather than reproducing real query semantics.
// ---------------------------------------------------------------------------
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDoc = vi.fn();

vi.mock('../../firebase', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
  functions: {},
  facebookProvider: {},
  trackEvent: vi.fn(),
}));

let collections: Record<string, any[]> = {};

function snapFor(path: string) {
  const data = collections[path] || [];
  return {
    docs: data.map((d) => ({
      id: d.id,
      data: () => d,
      ref: { path: `${path}/${d.id}` },
    })),
  };
}

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: any, name: string) => ({ path: name })),
  collectionGroup: vi.fn((_db: any, name: string) => ({ path: name })),
  query: vi.fn((ref: any) => ref),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  doc: vi.fn((_db: any, ...segments: string[]) => ({ path: segments.join('/') })),
  getDocs: vi.fn((ref: any) => Promise.resolve(snapFor(ref.path))),
  getDoc: (ref: any) => mockGetDoc(ref),
  updateDoc: (ref: any, data: any) => mockUpdateDoc(ref, data),
  deleteDoc: (ref: any) => mockDeleteDoc(ref),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
}));

function createMockStore(isAdmin = true) {
  return createStore({
    getters: {
      isAdmin: () => isAdmin,
      authReady: () => true,
    },
  });
}

function mountAdminInbox(store: ReturnType<typeof createMockStore>) {
  return mount(AdminInboxView, {
    global: { plugins: [store] },
  });
}

describe('AdminInboxView — Support Tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collections = {
      claim_requests: [],
      draft_profiles: [],
      draft_classifieds: [],
      directory_members: [],
      messages: [],
      inquiry_threads: [
        { id: 'support_user-1', userUid: 'user-1', lastMessage: 'Help with my listing', type: 'support' },
        { id: 'support_user-2', userUid: 'user-2', lastMessage: 'Closed already', type: 'support', status: 'closed' },
      ],
    };
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
  });

  it('excludes closed tickets from the Support Tickets list and count', async () => {
    const wrapper = mountAdminInbox(createMockStore());
    await flushPromises();

    expect(wrapper.text()).toContain('Support Tickets (1)');
    expect(wrapper.text()).toContain('Help with my listing');
    expect(wrapper.text()).not.toContain('Closed already');
  });

  it('shows the empty state once every ticket is closed', async () => {
    collections.inquiry_threads = [
      { id: 'support_user-2', userUid: 'user-2', lastMessage: 'Closed already', type: 'support', status: 'closed' },
    ];
    const wrapper = mountAdminInbox(createMockStore());
    await flushPromises();

    expect(wrapper.text()).toContain('Support Tickets (0)');
    expect(wrapper.text()).toContain('No active support tickets.');
  });

  it('closing an open ticket writes status "closed" to the right thread and removes it from the list', async () => {
    const wrapper = mountAdminInbox(createMockStore());
    await flushPromises();

    const closeButton = wrapper.findAll('button').find(b => b.text() === 'Close');
    expect(closeButton).toBeTruthy();

    await closeButton!.trigger('click');
    await flushPromises();

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { path: 'inquiry_threads/support_user-1' },
      { status: 'closed' }
    );
  });

  it('denies access to non-admins', async () => {
    const wrapper = mountAdminInbox(createMockStore(false));
    await flushPromises();

    expect(wrapper.text()).toContain('Access Denied');
  });
});
