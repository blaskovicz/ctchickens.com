import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import { createRouter, createWebHashHistory } from 'vue-router';
import ClassifiedsView from '../../views/ClassifiedsView.vue';
import type { Classified, DraftClassified } from '../../types';

// Router stub — ClassifiedsView uses useRouter().push()
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/classified/:docId', component: { template: '<div />' } },
    { path: '/classified', component: { template: '<div />' } },
  ]
});

const makeClassified = (overrides: Partial<Classified> = {}): Classified => ({
  id: 'test-id',
  owner_uid: 'owner-1',
  display_name: 'Test User',
  location: 'Storrs, CT',
  title: 'Silkie Hens Wanted',
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
  display_name: 'Test User',
  location: 'Storrs, CT',
  title: 'Hatching Eggs For Sale',
  description: 'Selling hatching eggs',
  category: 'hatching_eggs',
  status: 'pending',
  created_at: { toDate: () => new Date() },
  ...overrides,
});

const createMockStore = (opts: {
  user?: any;
  classifieds?: Classified[];
  myClassifieds?: (Classified | DraftClassified)[];
  isAdmin?: boolean;
} = {}) => {
  return createStore({
    state: {
      user: opts.user ?? null,
      breeders: [],
      classifieds: opts.classifieds ?? [],
      myClassifieds: opts.myClassifieds ?? [],
    },
    getters: {
      isLoggedIn: (state: any) => !!state.user,
      isAdmin: () => opts.isAdmin ?? false,
    },
    actions: {
      fetchClassifieds: vi.fn() as any,
      fetchMyClassifieds: vi.fn() as any,
    },
    mutations: {
      SET_CLASSIFIEDS(state: any, p: Classified[]) { state.classifieds = p; },
      SET_MY_CLASSIFIEDS(state: any, p: any[]) { state.myClassifieds = p; },
    },
  });
};

describe('ClassifiedsView', () => {
  beforeEach(async () => {
    await router.push('/');
    await router.isReady();
  });

  it('renders a list of active classifieds', async () => {
    const store = createMockStore({
      classifieds: [
        makeClassified({ id: 'c1', title: 'Silkies Wanted', description: 'Looking for Silkies', location: 'Storrs, CT' }),
        makeClassified({ id: 'c2', title: 'Buff Orpingtons For Sale', description: 'Selling Buff Orpingtons', category: 'for_sale', location: 'Hartford, CT' }),
      ],
    });

    const wrapper = mount(ClassifiedsView, {
      global: { plugins: [store, router], stubs: { NewClassifiedModal: true } }
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Silkies Wanted');
    expect(wrapper.text()).toContain('Buff Orpingtons For Sale');
  });

  it('text filter hides non-matching classifieds', async () => {
    const store = createMockStore({
      classifieds: [
        makeClassified({ id: 'c1', title: 'Silkie Hens Available', description: 'Great silkie hens for sale', location: 'Storrs, CT' }),
        makeClassified({ id: 'c2', title: 'Buff Orpington Eggs', description: 'Hatching eggs from my flock', location: 'Hartford, CT' }),
      ],
    });

    const wrapper = mount(ClassifiedsView, {
      global: { plugins: [store, router], stubs: { NewClassifiedModal: true } }
    });
    await flushPromises();

    const textInput = wrapper.find('input[placeholder="Search descriptions..."]');
    await textInput.setValue('silkie');

    expect(wrapper.text()).toContain('Silkie Hens Available');
    expect(wrapper.text()).not.toContain('Buff Orpington Eggs');
  });

  it('location filter hides non-matching classifieds', async () => {
    const store = createMockStore({
      classifieds: [
        makeClassified({ id: 'c1', description: 'Listing A', location: 'Storrs, CT' }),
        makeClassified({ id: 'c2', description: 'Listing B', location: 'Hartford, CT' }),
      ],
    });

    const wrapper = mount(ClassifiedsView, {
      global: { plugins: [store, router], stubs: { NewClassifiedModal: true } }
    });
    await flushPromises();

    const locInput = wrapper.find('input[placeholder="Filter by location..."]');
    await locInput.setValue('hartford');

    expect(wrapper.text()).not.toContain('Listing A');
    expect(wrapper.text()).toContain('Listing B');
  });

  it('category filter hides non-matching classifieds', async () => {
    const store = createMockStore({
      classifieds: [
        makeClassified({ id: 'c1', description: 'ISO listing', category: 'iso' }),
        makeClassified({ id: 'c2', description: 'For sale listing', category: 'for_sale' }),
      ],
    });

    const wrapper = mount(ClassifiedsView, {
      global: { plugins: [store, router], stubs: { NewClassifiedModal: true } }
    });
    await flushPromises();

    const select = wrapper.find('select');
    await select.setValue('iso');

    expect(wrapper.text()).toContain('ISO listing');
    expect(wrapper.text()).not.toContain('For sale listing');
  });

  it('shows "Under Review" / Pending Approval badge for owner\'s pending listing', async () => {
    const ownerId = 'owner-1';
    const draft = makeDraft({ owner_uid: ownerId, title: 'My Pending Ad', description: 'Detailed description of my pending ad' });

    const store = createMockStore({
      user: { uid: ownerId },
      classifieds: [],
      myClassifieds: [draft],
    });

    const wrapper = mount(ClassifiedsView, {
      global: { plugins: [store, router], stubs: { NewClassifiedModal: true } }
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Pending Approval');
    expect(wrapper.text()).toContain('My Pending Ad');
  });

  it('does not show pending listings section when user has no pending classifieds', async () => {
    const store = createMockStore({
      user: { uid: 'owner-1' },
      classifieds: [makeClassified()],
      myClassifieds: [],
    });

    const wrapper = mount(ClassifiedsView, {
      global: { plugins: [store, router], stubs: { NewClassifiedModal: true } }
    });
    await flushPromises();

    expect(wrapper.text()).not.toContain('Pending Approval');
    expect(wrapper.text()).not.toContain('Your Pending Listings');
  });

  it('shows empty state when no classifieds match filters', async () => {
    const store = createMockStore({
      classifieds: [makeClassified({ id: 'c1', description: 'Silkie hens', location: 'Storrs, CT' })],
    });

    const wrapper = mount(ClassifiedsView, {
      global: { plugins: [store, router], stubs: { NewClassifiedModal: true } }
    });
    await flushPromises();

    await wrapper.find('input[placeholder="Search descriptions..."]').setValue('xyzzy-no-match');
    expect(wrapper.text()).toContain('No active classifieds found');
  });

  it('dispatches fetchClassifieds on mount', async () => {
    const store = createMockStore();
    const spy = vi.spyOn(store, 'dispatch');

    mount(ClassifiedsView, {
      global: { plugins: [store, router], stubs: { NewClassifiedModal: true } }
    });
    await flushPromises();

    expect(spy).toHaveBeenCalledWith('fetchClassifieds');
  });

  it('dispatches fetchMyClassifieds when logged in', async () => {
    const store = createMockStore({ user: { uid: 'user-1' } });
    const spy = vi.spyOn(store, 'dispatch');

    mount(ClassifiedsView, {
      global: { plugins: [store, router], stubs: { NewClassifiedModal: true } }
    });
    await flushPromises();

    expect(spy).toHaveBeenCalledWith('fetchMyClassifieds', 'user-1');
  });

  it('does not dispatch fetchMyClassifieds when logged out', async () => {
    const store = createMockStore({ user: null });
    const spy = vi.spyOn(store, 'dispatch');

    mount(ClassifiedsView, {
      global: { plugins: [store, router], stubs: { NewClassifiedModal: true } }
    });
    await flushPromises();

    const calls = spy.mock.calls.map(c => c[0]);
    expect(calls).not.toContain('fetchMyClassifieds');
  });
});
