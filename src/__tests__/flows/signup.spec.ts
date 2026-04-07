import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import storeDefault from '../../store'; // We need to get the config somehow
import BreederSignupView from '../../views/BreederSignupView.vue';
import BreederEditView from '../../views/BreederEditView.vue';
import HomeView from '../../views/HomeView.vue';
import { 
  clearFirestoreEmulator, 
  clearAuthEmulator, 
  createTestUser,
  seedDraftProfile
} from '../test-helpers';
import { db } from '../../firebase';
import { getDoc, doc } from 'firebase/firestore';
import { BApp } from 'bootstrap-vue-next';

// 1. Mock the image asset
vi.mock('/ct_chickens_2025_square.png', () => ({
  default: 'mocked-image-path'
}));

// We'll extract actions/mutations from the default store if we can't import config
// BUT the current store is exported as an instance.
// Let's try to reset it EXTREMELY aggressively.

describe('Self-Service Signup Flow', () => {
  let router: any;
  let store: any = storeDefault;

  beforeEach(async () => {
    // 1. Clear Emulators
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    
    // 2. Wait a bit for emulator consistency
    await new Promise(r => setTimeout(r, 200));

    // 3. Reset Store State
    store.commit('SET_BREEDERS', []);
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
    store.commit('SET_MY_DRAFTS', []);
    store.commit('SET_AUTH_READY', false);
    store.commit('CLEAR_TOASTS');

    // 4. Fresh Router for every test
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: HomeView },
        { path: '/get-listed', component: BreederSignupView },
        { path: '/get-listed/:slug', component: BreederSignupView },
        { path: '/directory/:slug', component: { template: '<div>Profile Page</div>' } },
        { path: '/directory/:slug/edit', component: BreederEditView },
      ]
    });

    await router.push('/get-listed');
    await router.isReady();
  });

  const SignupWrapper = defineComponent({
    setup() {
      return () => h(BApp, null, {
        default: () => h(BreederSignupView)
      });
    }
  });

  const EditWrapper = defineComponent({
    setup() {
      return () => h(BApp, null, {
        default: () => h(BreederEditView)
      });
    }
  });

  it('1. user not logged in -> get-listed page -> must log in', async () => {
    const wrapper = mount(SignupWrapper, {
      global: {
        plugins: [store, router],
        stubs: {
          'router-link': true,
          'router-view': true,
          'img': true
        }
      }
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Facebook Login Required');
    expect(wrapper.find('button.btn-facebook').exists()).toBe(true);
    expect(wrapper.find('form.signup-form').exists()).toBe(false);
  });

  it('2. user logged in -> submits farm name -> shows pending', async () => {
    const user = await createTestUser('farmer-new-2@example.com', 'Farmer Two');
    store.commit('SET_USER', user);
    store.commit('SET_USER_DATA', { displayName: 'Farmer Two', email: 'farmer-new-2@example.com' });
    store.commit('SET_AUTH_READY', true);

    const wrapper = mount(SignupWrapper, {
      global: {
        plugins: [store, router],
        stubs: { 'img': true }
      }
    });

    await flushPromises();

    const form = wrapper.find('form.signup-form');
    expect(form.exists()).toBe(true);

    await wrapper.find('#biz-name').setValue('Flow Test Farm Two Unique');
    await wrapper.find('#town').setValue('New Haven, CT');
    
    // We trigger the submit but we need to wait for the ASYNC action inside the component
    // BreederSignupView.vue: handleSubmit is async.
    await form.trigger('submit.prevent');
    
    // flushPromises() only waits for resolved promises, but if the component
    // has a chain of awaits, we might need multiple flushes or a timeout.
    await flushPromises();
    await new Promise(r => setTimeout(r, 500)); // Give Firestore transaction time
    await flushPromises();

    // Verify redirect
    expect(router.currentRoute.value.path).toBe('/get-listed/flow-test-farm-two-unique');
    
    expect(wrapper.text()).toContain('Listing Submitted!');
    expect(wrapper.text()).toContain('Flow Test Farm Two Unique');
  });

  it('3. admin logs in -> approves -> farm now in directory', async () => {
    const farmerUid = 'farmer-uid-admin-3';
    const farmSlug = 'approved-flow-farm-3';
    
    await seedDraftProfile(farmSlug, {
      profile: {
        businessName: 'Approved Flow Farm 3',
        town: 'Windham, CT',
        memberType: 'farm'
      },
      draft_owner_uid: farmerUid
    });

    const admin = await createTestUser('admin-flow-3@ctchickens.com', 'Admin Three', true);
    store.commit('SET_USER', admin);
    store.commit('SET_USER_DATA', { isAdmin: true });
    store.commit('SET_AUTH_READY', true);

    await router.push(`/directory/${farmSlug}/edit`);
    await router.isReady();

    const wrapper = mount(EditWrapper, {
      global: {
        plugins: [store, router],
        stubs: {
          BreederGallery: true,
          'img': true
        }
      }
    });

    await flushPromises();
    await new Promise(r => setTimeout(r, 500));
    await flushPromises();

    expect(wrapper.text()).toContain('NEW LISTING');
    
    const submitBtn = wrapper.find('button[type="submit"]');
    await submitBtn.trigger('click');
    await flushPromises();

    const modalPublishBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Publish Live') && b.classList.contains('btn-primary'));
    
    expect(modalPublishBtn).toBeDefined();
    modalPublishBtn?.click();

    await flushPromises();
    await new Promise(r => setTimeout(r, 1000));
    await flushPromises();

    const liveDoc = await getDoc(doc(db, 'directory_members', farmSlug));
    expect(liveDoc.exists()).toBe(true);
    expect(router.currentRoute.value.path).toBe(`/directory/${farmSlug}`);
  });

  it('4. user sees farm in directory after approval', async () => {
    const farmSlug = 'published-flow-farm-4';
    const farmerEmail = 'farmer-flow-4@example.com';
    const farmerName = 'Farmer Four';
    
    const user = await createTestUser(farmerEmail, farmerName);
    
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/directory_members/${farmSlug}`;
    
    const payload = {
      fields: {
        profile: { mapValue: { fields: {
          businessName: { stringValue: 'Published Flow Farm 4' },
          town: { stringValue: 'Tolland, CT' },
          memberType: { stringValue: 'farm' }
        }}},
        account: { mapValue: { fields: {
          status: { stringValue: 'published' },
          ownerUid: { stringValue: user.uid },
          updatedAt: { timestampValue: new Date().toISOString() }
        }}},
        offerings: { mapValue: { fields: { description: { stringValue: '' }, searchTags: { arrayValue: { values: [] } } } } },
        media: { mapValue: { fields: { logoUrl: { nullValue: null }, galleryUrls: { arrayValue: { values: [] } } } } }
      }
    };

    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
      body: JSON.stringify(payload)
    });

    store.commit('SET_USER', user);
    store.commit('SET_USER_DATA', { displayName: farmerName, email: farmerEmail });
    store.commit('SET_AUTH_READY', true);

    await store.dispatch('fetchDirectory');

    const myBreeders = store.getters.myBreeders;
    expect(myBreeders.some((b: any) => b.id === farmSlug)).toBe(true);
  });
});
