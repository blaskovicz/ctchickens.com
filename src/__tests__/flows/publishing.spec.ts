import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import BreederEditView from '../../views/BreederEditView.vue';
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
    { path: '/directory/:slug/edit', component: BreederEditView },
    { path: '/directory/:slug', component: { template: '<div>Profile</div>' } }
  ]
});

const TestApp = defineComponent({
  setup() {
    return () => h(BApp, null, {
      default: () => h(BreederEditView)
    });
  }
});

describe('Publishing Flow', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    store.commit('SET_BREEDERS', []);
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
    
    // Set current route
    router.push('/directory/test-farm/edit');
    await router.isReady();
  });

  it('admin can publish changes and store is refreshed', async () => {
    const businessSlug = 'test-farm';
    const initialTown = 'Hartford';
    const updatedTown = 'New Haven';

    // 1. Seed the breeder
    await seedTestBreeder(businessSlug, {
      profile: { 
        businessName: 'Test Farm', 
        town: initialTown 
      }
    });

    // 2. Setup Admin user
    const user = await createTestUser('admin@example.com', 'Admin User', true);
    store.commit('SET_USER', user);
    store.commit('SET_USER_DATA', { isAdmin: true });

    // 3. Mount Test App
    const wrapper = mount(TestApp, {
      global: {
        plugins: [store, router],
        stubs: {
          BreederGallery: true
        }
      }
    });

    // Wait for data loading
    await flushPromises();
    await new Promise(r => setTimeout(r, 500));
    await flushPromises();

    // 4. Verify initial data loaded into the form
    const townInput = wrapper.find('input[required]');
    expect((townInput.element as HTMLInputElement).value).toBe(initialTown);

    // 5. Change the town
    await townInput.setValue(updatedTown);

    // 6. Trigger Publish
    const submitBtn = wrapper.find('button[type="submit"]');
    await submitBtn.trigger('click');
    await flushPromises();

    // 7. Find and click modal button
    await flushPromises();
    const modalPublishBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Publish Live') && b.classList.contains('btn-primary'));
    
    expect(modalPublishBtn).toBeDefined();
    modalPublishBtn?.click();

    // 8. Wait for completions
    await flushPromises();
    await new Promise(r => setTimeout(r, 1000));
    await flushPromises();
    await new Promise(r => setTimeout(r, 1000));
    await flushPromises();

    // 9. Verify Firestore was updated
    const liveDoc = await getDoc(doc(db, 'directory_members', businessSlug));
    expect(liveDoc.exists()).toBe(true);
    expect(liveDoc.data()?.profile.town).toBe(updatedTown);

    // 10. VERIFY STORE REFRESH (The main fix)
    const storeBreeder = store.getters.allBreeders.find((b: any) => b.name === 'Test Farm');
    expect(storeBreeder).toBeDefined();
    expect(storeBreeder.location).toBe(updatedTown);
    
    // 11. Verify redirect happened
    expect(router.currentRoute.value.path).toBe(`/directory/${businessSlug}`);
  }, 20000);
});
