import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';
import HomeView from '../../views/HomeView.vue';
import store from '../../store';
import { createRouter, createWebHistory } from 'vue-router';
import { clearFirestoreEmulator, seedTestBreeder } from '../test-helpers';

// Setup router for the test
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/about', name: 'about', component: { template: '<div>About</div>' } },
    { path: '/directory/:slug', name: 'breeder-profile', component: { template: '<div>Profile</div>' } }
  ]
});

describe('Directory Flow - Unauthenticated User', () => {
  beforeEach(async () => {
    // 1. Clear state
    await clearFirestoreEmulator();
    store.commit('SET_BREEDERS', []);
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
  });

  it('unauthenticated user can see directory listings', async () => {
    // 2. Seed a farm
    await seedTestBreeder('happy-hens-farm', {
      profile: { businessName: 'Happy Hens Farm', town: 'Storrs' }
    });

    // 3. Trigger directory fetch in the store
    await store.dispatch('fetchDirectory');

    // 4. Mount HomeView
    const wrapper = mount(HomeView, {
      global: {
        plugins: [store, router]
      }
    });

    // 5. Wait for potential async rendering (Vuex getters, etc)
    await flushPromises();

    // 6. Assert listing is visible
    expect(wrapper.text()).toContain('Happy Hens Farm');
    expect(wrapper.text()).toContain('Storrs');
    
    // Check for the table header to ensure we're looking at the directory section
    expect(wrapper.text()).toContain('Local Breeder & Supplier Directory');
  });

  it('user without farm does not see claim banner if not logged in', async () => {
    // Ensure we are logged out (already done in beforeEach)
    const wrapper = mount(HomeView, {
      global: {
        plugins: [store, router]
      }
    });
    
    await flushPromises();
    
    // The ClaimBanner component only shows if suggestedClaim getter returns something
    // suggestedClaim only returns something if user is logged in
    expect(wrapper.text()).not.toContain('Is this your business?');
  });
});
