import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import { createRouter, createWebHashHistory } from 'vue-router';
import InboxView from '../InboxView.vue';

// ---------------------------------------------------------------------------
// Firebase mock — InboxView subscribes to the thread list and the active
// thread's messages via onSnapshot. The mock routes on the ref's `path` (set
// by the collection()/doc() stubs below) instead of reproducing real query
// semantics, and fires synchronously with whatever test data is in scope.
// ---------------------------------------------------------------------------
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);

let threadDocs: any[] = [];
let messageDocs: any[] = [];

vi.mock('../../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'admin-1' } },
  storage: {},
  functions: {},
  facebookProvider: {},
  trackEvent: vi.fn(),
  messaging: null,
  VAPID_KEY: 'test-vapid-key',
}));

vi.mock('../../composables/useNotifications', () => ({
  useNotifications: () => ({
    requestPermission: vi.fn(),
    sendTestNotification: vi.fn(),
    permissionState: { value: 'unsupported' },
    isPushSupported: false,
  }),
}));

vi.mock('../../composables/useSupport', () => ({
  useSupport: () => ({ contactSupport: vi.fn() }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: any, ...segments: string[]) => ({ path: segments.join('/') })),
  doc: vi.fn((_db: any, ...segments: string[]) => ({ path: segments.join('/') })),
  query: vi.fn((ref: any) => ref),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
  onSnapshot: vi.fn((ref: any, successCb: any) => {
    if (ref.path === 'inquiry_threads') {
      successCb({ docs: threadDocs.map(d => ({ id: d.id, data: () => d })) });
    } else {
      // Any thread's messages subcollection.
      successCb({ docs: messageDocs.map(d => ({ id: d.id, data: () => d })) });
    }
    return vi.fn(); // unsubscribe
  }),
  updateDoc: (ref: any, data: any) => mockUpdateDoc(ref, data),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  runTransaction: vi.fn(),
  writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
}));

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/inbox/:threadId?', name: 'inbox', component: InboxView },
  ],
});

function createMockStore(opts: { isAdmin?: boolean } = {}) {
  return createStore({
    state: {
      user: { uid: 'admin-1', displayName: 'Admin' },
      lastFetch: null,
      breeders: [],
    },
    getters: {
      isAdmin: () => opts.isAdmin ?? true,
      ownedSlugs: () => [],
    },
    actions: {
      fetchDirectory: vi.fn(),
    },
  });
}

async function mountInbox(store: ReturnType<typeof createMockStore>, threadId: string) {
  await router.push(`/inbox/${threadId}`);
  await router.isReady();
  const wrapper = mount(InboxView, { global: { plugins: [store, router] } });
  await flushPromises();
  return wrapper;
}

const supportThread = {
  id: 'support_user-1',
  type: 'support',
  participants: ['user-1', 'admin'],
  userUid: 'user-1',
  userName: 'Jane Doe',
  breederSlug: 'support',
  breederName: 'Site Support',
  lastMessage: 'Need help',
  unreadCount: {},
};

const ts = (date: string) => ({ toDate: () => new Date(date) });

describe('InboxView — thread type/status visibility and admin close/reopen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageDocs = [];
  });

  it('shows a type badge and no Closed badge for an open support thread', async () => {
    threadDocs = [supportThread];
    const wrapper = await mountInbox(createMockStore(), 'support_user-1');

    expect(wrapper.text()).toContain('Support');
    expect(wrapper.text()).not.toContain('Closed');
  });

  it('shows a Closed badge in the thread list for a closed support thread', async () => {
    threadDocs = [{ ...supportThread, status: 'closed' }];
    const wrapper = await mountInbox(createMockStore(), 'support_user-1');

    expect(wrapper.text()).toContain('Closed');
  });

  it('shows a reopen-by-messaging banner in the conversation for a closed ticket, and not for an open one', async () => {
    threadDocs = [{ ...supportThread, status: 'closed' }];
    const closedWrapper = await mountInbox(createMockStore(), 'support_user-1');
    expect(closedWrapper.text()).toContain('This ticket is closed. Send a message below to reopen it.');

    threadDocs = [supportThread];
    const openWrapper = await mountInbox(createMockStore(), 'support_user-1');
    expect(openWrapper.text()).not.toContain('This ticket is closed');
  });

  it('admin sees a Close button on an open support thread, and clicking it writes status "closed"', async () => {
    threadDocs = [supportThread];
    const wrapper = await mountInbox(createMockStore({ isAdmin: true }), 'support_user-1');

    const closeButton = wrapper.findAll('button').find(b => b.text() === 'Close');
    expect(closeButton).toBeTruthy();

    await closeButton!.trigger('click');
    await flushPromises();

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { path: 'inquiry_threads/support_user-1' },
      { status: 'closed' }
    );
  });

  it('admin sees a Reopen button on a closed support thread, and clicking it writes status "open"', async () => {
    threadDocs = [{ ...supportThread, status: 'closed' }];
    const wrapper = await mountInbox(createMockStore({ isAdmin: true }), 'support_user-1');

    const reopenButton = wrapper.findAll('button').find(b => b.text() === 'Reopen');
    expect(reopenButton).toBeTruthy();

    await reopenButton!.trigger('click');
    await flushPromises();

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { path: 'inquiry_threads/support_user-1' },
      { status: 'open' }
    );
  });

  it('does not show a Close/Reopen button to non-admins', async () => {
    threadDocs = [supportThread];
    const wrapper = await mountInbox(createMockStore({ isAdmin: false }), 'support_user-1');

    const toggleButton = wrapper.findAll('button').find(b => b.text() === 'Close' || b.text() === 'Reopen');
    expect(toggleButton).toBeFalsy();
  });
});

describe('InboxView — date dividers in the message pane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    threadDocs = [supportThread];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows one date divider above a single day\'s worth of messages', async () => {
    messageDocs = [
      { id: 'm1', senderUid: 'user-1', text: 'Hi', createdAt: ts('2026-03-05T08:00:00'), read: true },
      { id: 'm2', senderUid: 'admin-1', text: 'Hello', createdAt: ts('2026-03-05T09:00:00'), read: true },
    ];
    const wrapper = await mountInbox(createMockStore(), 'support_user-1');

    expect(wrapper.findAll('.date-divider')).toHaveLength(1);
    expect(wrapper.find('.date-divider').text()).toBe('Today');
  });

  it('shows a divider per day when messages span multiple days', async () => {
    messageDocs = [
      { id: 'm1', senderUid: 'user-1', text: 'Yesterday message', createdAt: ts('2026-03-04T10:00:00'), read: true },
      { id: 'm2', senderUid: 'admin-1', text: 'Today message', createdAt: ts('2026-03-05T09:00:00'), read: true },
    ];
    const wrapper = await mountInbox(createMockStore(), 'support_user-1');

    const dividers = wrapper.findAll('.date-divider').map(d => d.text());
    expect(dividers).toEqual(['Yesterday', 'Today']);
  });

  it('does not render a divider for a message still awaiting its server timestamp', async () => {
    messageDocs = [
      { id: 'm1', senderUid: 'user-1', text: 'Synced', createdAt: ts('2026-03-05T08:00:00'), read: true },
      { id: 'm2', senderUid: 'admin-1', text: 'Just sent', createdAt: null, read: false },
    ];
    const wrapper = await mountInbox(createMockStore(), 'support_user-1');

    expect(wrapper.findAll('.date-divider')).toHaveLength(1);
  });
});
