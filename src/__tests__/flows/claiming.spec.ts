import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import HomeView from '../../views/HomeView.vue';
import ClaimBanner from '../../components/ClaimBanner.vue';
import store from '../../store';
import { createRouter, createWebHistory } from 'vue-router';
import { 
  clearFirestoreEmulator, 
  clearAuthEmulator, 
  seedTestBreeder, 
  createTestUser 
} from '../test-helpers';
import { db } from '../../firebase';
import { getDoc, doc } from 'firebase/firestore';
import { BApp } from 'bootstrap-vue-next';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/directory/:slug', name: 'breeder-profile', component: { template: '<div>Profile</div>' } }
  ]
});

const TestApp = defineComponent({
  setup() {
    return () => h(BApp, null, {
      default: () => h('div', [
        h(ClaimBanner),
        h(HomeView)
      ])
    });
  }
});

describe('Claiming Flow', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    store.commit('SET_BREEDERS', []);
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
    store.commit('SET_ACTIVE_CLAIMS', []);
  });

  it('user sees claim banner and can submit a claim request', async () => {
    const testEmail = `owner-${Date.now()}@example.com`;
    const businessName = 'Claimable Farm';
    const businessSlug = 'claimable-farm';

    // 1. Seed a farm via REST bypass
    // Ensure contact_link matches the user email
    await seedTestBreeder(businessSlug, {
      profile: { 
        businessName, 
        contactEmail: testEmail 
      },
      account: { ownerUid: null }
    });

    // 2. Create and Login the user
    const user = await createTestUser(testEmail, 'Test Owner');
    
    // DEBUG: Check the token claims
    const tokenResult = await user.getIdTokenResult();
    console.log('Token Claims:', JSON.stringify(tokenResult.claims, null, 2));

    store.commit('SET_USER', user);
    
    // Refresh directory to ensure getter sees the new breeder
    await store.dispatch('fetchDirectory');
    await flushPromises();

    // 3. Mount View
    const wrapper = mount(TestApp, {
      global: {
        plugins: [store, router]
      }
    });

    await flushPromises();
    await new Promise(r => setTimeout(r, 500));
    await flushPromises();

    // 4. Assert Banner is visible
    expect(wrapper.text()).toContain('Is this your business?');
    expect(wrapper.text()).toContain(businessName);

    // 5. Click the Claim button
    const claimButton = wrapper.find('button.claim-btn');
    expect(claimButton.exists()).toBe(true);
    await claimButton.trigger('click');

    await flushPromises();

    // 6. Assert Firestore Request exists
    const claimDoc = await getDoc(doc(db, 'claim_requests', businessSlug));
    expect(claimDoc.exists()).toBe(true);
    expect(claimDoc.data()?.requesterUid).toBe(user.uid);
  }, 15000);

  it('user with matching localEmail (not oauth email) sees claim banner and can submit a claim', async () => {
    const oauthEmail = `oauth-${Date.now()}@example.com`;
    const localEmail = `local-${Date.now()}@example.com`;
    const businessName = 'Local Email Farm';
    const businessSlug = 'local-email-farm';

    // 1. Seed farm whose contactEmail matches localEmail, not oauth email
    await seedTestBreeder(businessSlug, {
      profile: { businessName, contactEmail: localEmail },
      account: { ownerUid: null }
    });

    // 2. Create user whose OAuth email does NOT match the farm
    const user = await createTestUser(oauthEmail, 'Local Email Owner');

    // 3. Patch the user doc to add a verified localEmail
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ct-chickens';
    const patchUrl = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/users/${user.uid}?updateMask.fieldPaths=localEmail`;
    await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
      body: JSON.stringify({ fields: { localEmail: { stringValue: localEmail } } })
    });

    store.commit('SET_USER', user);
    store.commit('SET_USER_DATA', { localEmail });

    await store.dispatch('fetchDirectory');
    await flushPromises();

    // 4. Mount and assert banner appears
    const wrapper = mount(TestApp, {
      global: { plugins: [store, router] }
    });

    await flushPromises();
    await new Promise(r => setTimeout(r, 500));
    await flushPromises();

    expect(wrapper.text()).toContain('Is this your business?');
    expect(wrapper.text()).toContain(businessName);

    // 5. Submit claim
    const claimButton = wrapper.find('button.claim-btn');
    expect(claimButton.exists()).toBe(true);
    await claimButton.trigger('click');
    await flushPromises();

    // 6. Assert claim doc created
    const claimDoc = await getDoc(doc(db, 'claim_requests', businessSlug));
    expect(claimDoc.exists()).toBe(true);
    expect(claimDoc.data()?.requesterUid).toBe(user.uid);
  }, 15000);
});
