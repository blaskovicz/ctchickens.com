import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import { createRouter, createWebHashHistory } from 'vue-router';
import ClassifiedDetailView from '../../views/ClassifiedDetailView.vue';
import type { Classified, DraftClassified } from '../../types';

// ---------------------------------------------------------------------------
// Firebase mock — ClassifiedDetailView reads live from Firestore on mount.
// We provide controlled snapshot data so tests don't hit the emulator.
// ---------------------------------------------------------------------------
const mockGetDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockAddDoc = vi.fn();
const mockWriteBatch = vi.fn();

const mockDeleteObject = vi.fn(() => Promise.resolve());
const mockStorageRef = vi.fn((_storage: any, _path: string) => ({ path: _path }));

vi.mock('../../firebase', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
  functions: {},
  facebookProvider: {},
  trackEvent: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: (...args: any[]) => mockStorageRef(...args),
  deleteObject: (...args: any[]) => mockDeleteObject(...args),
}));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    doc: vi.fn((_db: any, ...segments: string[]) => ({ path: segments.join('/') })),
    collection: vi.fn((_db: any, ...segments: string[]) => ({ path: segments.join('/') })),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    serverTimestamp: vi.fn(() => new Date()),
    writeBatch: (...args: any[]) => mockWriteBatch(...args),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/classified', component: { template: '<div />' } },
    { path: '/classified/:docId', name: 'classified-detail', component: ClassifiedDetailView },
  ]
});

const makeClassified = (overrides: Partial<Classified> = {}): Classified => ({
  id: 'classified-1',
  owner_uid: 'owner-1',
  display_name: 'Owner One',
  location: 'Storrs, CT',
  title: '5 Silkie Hens Wanted',
  description: 'Looking for 5 Silkie hens near Hartford',
  category: 'iso',
  status: 'active',
  expires_at: { toDate: () => new Date(Date.now() + 30 * 86400000) },
  renewal_count: 0,
  max_renewals: 2,
  created_at: { toDate: () => new Date() },
  ...overrides,
});

const makeDraft = (overrides: Partial<DraftClassified> = {}): DraftClassified => ({
  id: 'draft-1',
  owner_uid: 'owner-1',
  display_name: 'Owner One',
  location: 'Storrs, CT',
  title: 'Ayam Cemani Hatching Eggs',
  description: 'Selling hatching eggs from Ayam Cemani',
  category: 'hatching_eggs',
  status: 'pending',
  created_at: { toDate: () => new Date() },
  ...overrides,
});

const createMockStore = (opts: {
  user?: any;
  isAdmin?: boolean;
  myBreeders?: any[];
} = {}) =>
  createStore({
    state: {
      user: opts.user ?? null,
      classifieds: [],
    },
    getters: {
      isLoggedIn: (state: any) => !!state.user,
      isAdmin: () => opts.isAdmin ?? false,
      myBreeders: () => opts.myBreeders ?? [],
    },
    actions: {
      openPeerThread: vi.fn() as any,
    },
    mutations: {
      SET_CLASSIFIEDS(state: any, p: Classified[]) { state.classifieds = p; },
    },
  });

/**
 * Mounts ClassifiedDetailView with the given docId param and store.
 * onSnapshot fires synchronously with the supplied snapshot value.
 */
async function mountDetail(docId: string, store: any, snapData: Classified | null, draftData: DraftClassified | null = null) {
  // onSnapshot fires once with supplied data
  mockOnSnapshot.mockImplementation((_ref: any, successCb: any, _errCb: any) => {
    if (snapData) {
      successCb({ exists: () => true, id: snapData.id, data: () => ({ ...snapData }) });
    } else {
      successCb({ exists: () => false, id: docId, data: () => ({}) });
    }
    return vi.fn(); // unsubscribe
  });

  // getDoc for the live doc (used for draft fallback check)
  mockGetDoc.mockImplementation((ref: any) => {
    if (ref?.path?.startsWith('draft_classifieds')) {
      return Promise.resolve({
        exists: () => !!draftData,
        id: docId,
        data: () => draftData ? { ...draftData } : {},
      });
    }
    return Promise.resolve({
      exists: () => !!snapData,
      id: docId,
      data: () => snapData ? { ...snapData } : {},
    });
  });

  await router.push(`/classified/${docId}`);
  await router.isReady();

  const wrapper = mount(ClassifiedDetailView, {
    global: { plugins: [store, router] }
  });
  await flushPromises();
  return wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ClassifiedDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteBatch.mockReturnValue({
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn(() => Promise.resolve()),
    });
  });

  it('renders the classified title, description and location', async () => {
    const store = createMockStore();
    const classified = makeClassified({ title: '10 Silkie Hens Wanted', description: 'Looking for 10 Silkie hens', location: 'Lebanon, CT' });
    const wrapper = await mountDetail('classified-1', store, classified);

    expect(wrapper.text()).toContain('10 Silkie Hens Wanted');
    expect(wrapper.text()).toContain('Looking for 10 Silkie hens');
    expect(wrapper.text()).toContain('Lebanon, CT');
  });

  it('shows "not found" message when classified does not exist', async () => {
    const store = createMockStore();
    const wrapper = await mountDetail('nonexistent', store, null, null);

    expect(wrapper.text()).toContain('could not be found');
  });

  it('owner sees Renew button when within 2 days of expiry and renewals remain', async () => {
    const ownerId = 'owner-1';
    const store = createMockStore({ user: { uid: ownerId } });

    const classified = makeClassified({
      owner_uid: ownerId,
      renewal_count: 0,
      max_renewals: 2,
      // 1 day until expiry — inside the 2-day window
      expires_at: { toDate: () => new Date(Date.now() + 1 * 86400000) },
    });

    const wrapper = await mountDetail('classified-1', store, classified);

    const renewBtn = wrapper.findAll('button').find(b => b.text().includes('Renew'));
    expect(renewBtn).toBeDefined();
    expect(renewBtn?.exists()).toBe(true);
  });

  it('owner does not see Renew button when more than 2 days until expiry', async () => {
    const ownerId = 'owner-1';
    const store = createMockStore({ user: { uid: ownerId } });

    const classified = makeClassified({
      owner_uid: ownerId,
      renewal_count: 0,
      max_renewals: 2,
      // 10 days until expiry — outside the renewal window
      expires_at: { toDate: () => new Date(Date.now() + 10 * 86400000) },
    });

    const wrapper = await mountDetail('classified-1', store, classified);

    const renewBtn = wrapper.findAll('button').find(b => b.text().includes('Renew'));
    expect(renewBtn).toBeUndefined();
  });

  it('owner does not see Renew button when max renewals exhausted', async () => {
    const ownerId = 'owner-1';
    const store = createMockStore({ user: { uid: ownerId } });

    const classified = makeClassified({
      owner_uid: ownerId,
      renewal_count: 2,
      max_renewals: 2,
      expires_at: { toDate: () => new Date(Date.now() + 1 * 86400000) },
    });

    const wrapper = await mountDetail('classified-1', store, classified);

    const renewBtn = wrapper.findAll('button').find(b => b.text().includes('Renew'));
    expect(renewBtn).toBeUndefined();
  });

  it('non-owner does not see owner action buttons (Renew, Close Listing)', async () => {
    const store = createMockStore({ user: { uid: 'stranger-uid' } });

    const classified = makeClassified({
      owner_uid: 'owner-1',
      renewal_count: 0,
      max_renewals: 2,
      expires_at: { toDate: () => new Date(Date.now() + 1 * 86400000) },
    });

    const wrapper = await mountDetail('classified-1', store, classified);

    const allBtnText = wrapper.findAll('button').map(b => b.text());
    expect(allBtnText.some(t => t.includes('Renew'))).toBe(false);
    expect(allBtnText.some(t => t.includes('Close Listing'))).toBe(false);
  });

  it('logged-out user sees login prompt button but not owner actions', async () => {
    const store = createMockStore({ user: null });
    const classified = makeClassified({ owner_uid: 'owner-1' });
    const wrapper = await mountDetail('classified-1', store, classified);

    const allBtnText = wrapper.findAll('button').map(b => b.text());
    // Task 1: logged-out users now see a "Log in to Send a Message" CTA instead of being hidden
    expect(allBtnText.some(t => t.includes('Log in to Send a Message'))).toBe(true);
    // Owner-only controls must remain hidden
    expect(allBtnText.some(t => t.includes('Renew'))).toBe(false);
    expect(allBtnText.some(t => t.includes('Close Listing'))).toBe(false);
  });

  it('admin sees Publish Live and Discard Draft buttons on a draft', async () => {
    const adminStore = createMockStore({ user: { uid: 'admin-uid' }, isAdmin: true });

    // Draft path: live snap does not exist, draft snap does
    const draft = makeDraft({ id: 'draft-1', owner_uid: 'other-user' });
    const wrapper = await mountDetail('draft-1', adminStore, null, draft);

    const allBtnText = wrapper.findAll('button').map(b => b.text());
    expect(allBtnText.some(t => t.includes('Publish Live'))).toBe(true);
    expect(allBtnText.some(t => t.includes('Discard Draft'))).toBe(true);
  });

  it('non-admin does not see admin action buttons on a draft', async () => {
    const store = createMockStore({ user: { uid: 'owner-1' } });
    const draft = makeDraft({ id: 'draft-1', owner_uid: 'owner-1' });
    const wrapper = await mountDetail('draft-1', store, null, draft);

    const allBtnText = wrapper.findAll('button').map(b => b.text());
    expect(allBtnText.some(t => t.includes('Publish Live'))).toBe(false);
    expect(allBtnText.some(t => t.includes('Discard Draft'))).toBe(false);
  });

  it('shows "Pending Approval" badge on draft listing', async () => {
    const adminStore = createMockStore({ user: { uid: 'admin-uid' }, isAdmin: true });
    const draft = makeDraft();
    const wrapper = await mountDetail('draft-1', adminStore, null, draft);

    expect(wrapper.text()).toContain('Pending Approval');
  });

  it('owner sees Delete Draft button on a pending draft', async () => {
    const ownerId = 'owner-1';
    const store = createMockStore({ user: { uid: ownerId } });
    const draft = makeDraft({ id: 'draft-1', owner_uid: ownerId });
    const wrapper = await mountDetail('draft-1', store, null, draft);

    const allBtnText = wrapper.findAll('button').map(b => b.text());
    expect(allBtnText.some(t => t.includes('Delete Draft'))).toBe(true);
  });

  it('non-owner does not see Delete Draft button on a pending draft', async () => {
    const store = createMockStore({ user: { uid: 'stranger-uid' } });
    const draft = makeDraft({ id: 'draft-1', owner_uid: 'owner-1' });
    const wrapper = await mountDetail('draft-1', store, null, draft);

    const allBtnText = wrapper.findAll('button').map(b => b.text());
    expect(allBtnText.some(t => t.includes('Delete Draft'))).toBe(false);
  });

  it('admin sees Publish/Discard but not Delete Draft on a draft they do not own', async () => {
    const adminStore = createMockStore({ user: { uid: 'admin-uid' }, isAdmin: true });
    const draft = makeDraft({ id: 'draft-1', owner_uid: 'other-user' });
    const wrapper = await mountDetail('draft-1', adminStore, null, draft);

    const allBtnText = wrapper.findAll('button').map(b => b.text());
    expect(allBtnText.some(t => t.includes('Publish Live'))).toBe(true);
    expect(allBtnText.some(t => t.includes('Delete Draft'))).toBe(false);
  });

  it('handleDeleteDraft deletes the Firestore document', async () => {
    const ownerId = 'owner-1';
    const store = createMockStore({ user: { uid: ownerId } });
    const mockDeleteDoc = vi.fn(() => Promise.resolve());

    // Patch deleteDoc in the firestore mock
    const firestoreMod = await import('firebase/firestore');
    vi.spyOn(firestoreMod, 'deleteDoc').mockImplementation(mockDeleteDoc);

    const draft = makeDraft({ id: 'draft-1', owner_uid: ownerId });
    const wrapper = await mountDetail('draft-1', store, null, draft);

    await (wrapper.vm as any).handleDeleteDraft();
    await flushPromises();

    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('handleDeleteDraft calls deleteObject for image_url if present', async () => {
    const ownerId = 'owner-1';
    const store = createMockStore({ user: { uid: ownerId } });

    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/classifieds%2F${ownerId}%2Fimage.jpg?alt=media&token=abc`;
    const draft = makeDraft({ id: 'draft-1', owner_uid: ownerId, image_url: imageUrl });
    const wrapper = await mountDetail('draft-1', store, null, draft);

    await (wrapper.vm as any).handleDeleteDraft();
    await flushPromises();

    expect(mockDeleteObject).toHaveBeenCalled();
  });

  it('handleRenew writes a renew action doc', async () => {
    const ownerId = 'owner-1';
    const store = createMockStore({ user: { uid: ownerId } });
    mockAddDoc.mockResolvedValue({ id: 'action-id' });

    const classified = makeClassified({
      owner_uid: ownerId,
      renewal_count: 0,
      max_renewals: 2,
      expires_at: { toDate: () => new Date(Date.now() + 1 * 86400000) },
    });

    const wrapper = await mountDetail('classified-1', store, classified);

    const renewBtn = wrapper.findAll('button').find(b => b.text().includes('Renew'));
    expect(renewBtn?.exists()).toBe(true);
    await renewBtn!.trigger('click');
    await flushPromises();

    expect(mockAddDoc).toHaveBeenCalledOnce();
    const [, payload] = mockAddDoc.mock.calls[0] as any;
    expect(payload.action).toBe('renew');
    expect(payload.owner_uid).toBe(ownerId);
  });
});

// ---------------------------------------------------------------------------
// canRenew computed — unit-style tests without mounting
// ---------------------------------------------------------------------------
describe('ClassifiedDetailView: canRenew logic', () => {
  beforeEach(() => vi.clearAllMocks());

  const buildWrapperForCanRenew = async (
    user: any,
    classified: Classified
  ) => {
    const store = createMockStore({ user });
    mockOnSnapshot.mockImplementation((_ref: any, successCb: any) => {
      successCb({ exists: () => true, id: classified.id, data: () => ({ ...classified }) });
      return vi.fn();
    });
    mockGetDoc.mockResolvedValue({ exists: () => true, id: classified.id, data: () => ({ ...classified }) });

    await router.push(`/classified/${classified.id}`);
    await router.isReady();
    const wrapper = mount(ClassifiedDetailView, { global: { plugins: [store, router] } });
    await flushPromises();
    return wrapper;
  };

  it('canRenew is false when user is not the owner', async () => {
    const classified = makeClassified({
      owner_uid: 'owner-1',
      renewal_count: 0,
      max_renewals: 2,
      expires_at: { toDate: () => new Date(Date.now() + 1 * 86400000) },
    });
    const wrapper = await buildWrapperForCanRenew({ uid: 'stranger' }, classified);
    const renewBtn = wrapper.findAll('button').find(b => b.text().includes('Renew'));
    expect(renewBtn).toBeUndefined();
  });

  it('canRenew is false when no renewals remain', async () => {
    const classified = makeClassified({
      owner_uid: 'owner-1',
      renewal_count: 2,
      max_renewals: 2,
      expires_at: { toDate: () => new Date(Date.now() + 1 * 86400000) },
    });
    const wrapper = await buildWrapperForCanRenew({ uid: 'owner-1' }, classified);
    const renewBtn = wrapper.findAll('button').find(b => b.text().includes('Renew'));
    expect(renewBtn).toBeUndefined();
  });

  it('canRenew is false when more than 2 days until expiry', async () => {
    const classified = makeClassified({
      owner_uid: 'owner-1',
      renewal_count: 0,
      max_renewals: 2,
      expires_at: { toDate: () => new Date(Date.now() + 5 * 86400000) },
    });
    const wrapper = await buildWrapperForCanRenew({ uid: 'owner-1' }, classified);
    const renewBtn = wrapper.findAll('button').find(b => b.text().includes('Renew'));
    expect(renewBtn).toBeUndefined();
  });

  it('canRenew is true when owner, renewals remain, and within 2-day window', async () => {
    const classified = makeClassified({
      owner_uid: 'owner-1',
      renewal_count: 1,
      max_renewals: 2,
      expires_at: { toDate: () => new Date(Date.now() + 1 * 86400000) },
    });
    const wrapper = await buildWrapperForCanRenew({ uid: 'owner-1' }, classified);
    const renewBtn = wrapper.findAll('button').find(b => b.text().includes('Renew'));
    expect(renewBtn).toBeDefined();
    expect(renewBtn?.exists()).toBe(true);
  });
});
