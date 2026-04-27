import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import { createRouter, createWebHashHistory } from 'vue-router';
import NewClassifiedView from '../NewClassifiedView.vue';

const mockDeleteObject = vi.fn((_ref?: any) => Promise.resolve());

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
  connectStorageEmulator: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(() => Promise.resolve({ ref: 'mock-ref' })),
  getDownloadURL: vi.fn(() => Promise.resolve('https://mock-storage.com/image.jpg')),
  deleteObject: (ref: any) => mockDeleteObject(ref),
}));

const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
vi.stubGlobal('URL', {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

vi.mock('../../composables/useImageUtils', () => ({
  compressImage: vi.fn(() => Promise.resolve(new Blob(['mock content'], { type: 'image/jpeg' }))),
}));

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/classified', component: { template: '<div />' } },
    { path: '/classified/new', component: { template: '<div />' } },
  ],
});

const createMockStore = (opts: { isLoggedIn?: boolean; canPost?: boolean } = {}) =>
  createStore({
    state: {
      user: (opts.isLoggedIn ?? true) ? { uid: 'user-1', displayName: 'Test User' } : null,
    },
    getters: {
      isLoggedIn: (state: any) => !!state.user,
      currentUser: (state: any) => state.user,
      userTier: () => 'freemium',
      canPostClassified: () => opts.canPost ?? true,
    },
    actions: {
      createDraftClassified: vi.fn(() => Promise.resolve('new-doc-id')),
      loginWithFacebook: vi.fn() as any,
    },
  });

function mountView(store: ReturnType<typeof createMockStore>) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return mount(NewClassifiedView, {
    attachTo: div,
    global: { plugins: [store, router] },
  });
}

async function triggerFileChange(wrapper: any, file: File) {
  const input = wrapper.find('input[type="file"]').element as HTMLInputElement;
  const fileList = { 0: file, length: 1, item: (_i: number) => file };
  Object.defineProperty(input, 'files', { value: fileList, configurable: true });
  await wrapper.find('input[type="file"]').trigger('change');
  await flushPromises();
}

async function fillField(wrapper: any, selector: string, value: string) {
  await wrapper.find(selector).setValue(value);
}

async function fillValidForm(wrapper: any) {
  await fillField(wrapper, '.location-input', 'Hartford, CT');
  await fillField(wrapper, '.title-input', '6 Buff Orpington Pullets');
  await fillField(wrapper, '.description-input', 'Selling 6 Buff Orpington pullets ready to lay');
}

describe('NewClassifiedView', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await router.push('/classified/new');
    await router.isReady();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows login prompt when not logged in', async () => {
    const store = createMockStore({ isLoggedIn: false });
    const wrapper = mountView(store);
    await flushPromises();
    expect(wrapper.text()).toContain('signed in to post');
  });

  it('shows form when logged in', async () => {
    const store = createMockStore();
    const wrapper = mountView(store);
    await flushPromises();
    expect(wrapper.find('.title-input').exists()).toBe(true);
    expect(wrapper.find('.description-input').exists()).toBe(true);
  });

  it('submit button is disabled when description is less than 20 characters', async () => {
    const store = createMockStore();
    const wrapper = mountView(store);
    await flushPromises();

    await fillField(wrapper, '.description-input', 'Too short');
    await fillField(wrapper, '.location-input', 'Hartford, CT');
    await fillField(wrapper, '.title-input', 'Valid Title Here');

    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();
  });

  it('submit button is enabled when all fields are valid', async () => {
    const store = createMockStore();
    const wrapper = mountView(store);
    await flushPromises();

    await fillValidForm(wrapper);

    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined();
  });

  it('dispatches createDraftClassified with correct fields on valid submit', async () => {
    const store = createMockStore();
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    const wrapper = mountView(store);
    await flushPromises();

    await fillField(wrapper, '.category-select', 'for_sale');
    await fillField(wrapper, '.location-input', 'Lebanon, CT');
    await fillField(wrapper, '.title-input', '6 Buff Orpington Pullets');
    await fillField(wrapper, '.description-input', 'Selling 6 Buff Orpington pullets ready to lay');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(dispatchSpy).toHaveBeenCalledWith('createDraftClassified', expect.objectContaining({
      category: 'for_sale',
      location: 'Lebanon, CT',
      title: '6 Buff Orpington Pullets',
      description: 'Selling 6 Buff Orpington pullets ready to lay',
    }));
  });

  it('navigates to /classified after successful submit', async () => {
    const store = createMockStore();
    const wrapper = mountView(store);
    await flushPromises();

    await fillValidForm(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/classified');
  });

  describe('image upload', () => {
    it('shows a preview when a valid image is selected', async () => {
      const store = createMockStore();
      const wrapper = mountView(store);
      await flushPromises();

      const file = new File(['mock'], 'test.jpg', { type: 'image/jpeg' });
      await triggerFileChange(wrapper, file);

      expect(wrapper.find('.image-preview').exists()).toBe(true);
      expect((wrapper.find('.image-preview').element as HTMLImageElement).src).toContain('blob:mock-url');
    });

    it('removes preview when remove button is clicked', async () => {
      const store = createMockStore();
      const wrapper = mountView(store);
      await flushPromises();

      const file = new File(['mock'], 'test.jpg', { type: 'image/jpeg' });
      await triggerFileChange(wrapper, file);
      expect(wrapper.find('.image-preview').exists()).toBe(true);

      await wrapper.find('.remove-btn').trigger('click');
      await flushPromises();

      expect(wrapper.find('.image-preview').exists()).toBe(false);
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('uploads image and includes URL in submission', async () => {
      const store = createMockStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const wrapper = mountView(store);
      await flushPromises();

      await fillValidForm(wrapper);

      const file = new File(['data'], 'test.png', { type: 'image/png' });
      await triggerFileChange(wrapper, file);

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(dispatchSpy).toHaveBeenCalledWith('createDraftClassified', expect.objectContaining({
        image_url: 'https://mock-storage.com/image.jpg',
      }));
    });

    it('rejects files larger than 10MB', async () => {
      const store = createMockStore();
      const wrapper = mountView(store);
      await flushPromises();

      const largeFile = new File([''], 'big.jpg', { type: 'image/jpeg' });
      Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });
      await triggerFileChange(wrapper, largeFile);

      expect(wrapper.find('.image-preview').exists()).toBe(false);
    });

    it('rejects non-image files', async () => {
      const store = createMockStore();
      const wrapper = mountView(store);
      await flushPromises();

      const pdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      await triggerFileChange(wrapper, pdfFile);

      expect(wrapper.find('.image-preview').exists()).toBe(false);
    });

    it('deletes uploaded image when createDraftClassified fails (orphan cleanup)', async () => {
      const store = createMockStore();
      vi.spyOn(store, 'dispatch').mockImplementation((action: any) => {
        if (action === 'createDraftClassified') return Promise.reject(new Error('Firestore write failed'));
        return Promise.resolve();
      });

      const wrapper = mountView(store);
      await flushPromises();

      await fillValidForm(wrapper);

      const file = new File(['data'], 'test.png', { type: 'image/png' });
      await triggerFileChange(wrapper, file);

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(mockDeleteObject).toHaveBeenCalledWith('mock-ref');
    });
  });
});
