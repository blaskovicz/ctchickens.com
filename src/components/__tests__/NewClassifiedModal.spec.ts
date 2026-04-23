import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import NewClassifiedModal from '../NewClassifiedModal.vue';

const mockDeleteObject = vi.fn(() => Promise.resolve());

// Mock Firebase Storage
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
  connectStorageEmulator: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(() => Promise.resolve({ ref: 'mock-ref' })),
  getDownloadURL: vi.fn(() => Promise.resolve('https://mock-storage.com/image.jpg')),
  deleteObject: (...args: any[]) => mockDeleteObject(...args),
}));

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
vi.stubGlobal('URL', {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

const createMockStore = (isLoggedIn = true) =>
  createStore({
    state: { user: isLoggedIn ? { uid: 'user-1', displayName: 'Test User' } : null },
    getters: {
      isLoggedIn: (state: any) => !!state.user,
      currentUser: (state: any) => state.user,
      userTier: () => 'freemium',
      canPostClassified: () => true,
    },
    actions: {
      createDraftClassified: vi.fn(() => Promise.resolve('new-doc-id')),
      loginWithFacebook: vi.fn() as any,
    },
  });

/**
 * Mount NewClassifiedModal attached to document.body so that BModal's
 * <Teleport> lands inside the live document.
 */
function mountModal(store: ReturnType<typeof createMockStore>) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return mount(NewClassifiedModal, {
    attachTo: div,
    global: { plugins: [store] },
  });
}

async function setDocValue(selector: string, value: string) {
  const el = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (!el) throw new Error(`setDocValue: element not found for selector "${selector}"`);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await flushPromises();
}

function findDocButton(text: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(text)) as HTMLButtonElement | null;
}

describe('NewClassifiedModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('submit button is disabled when description is less than 20 characters', async () => {
    const store = createMockStore();
    const wrapper = mountModal(store);

    (wrapper.vm as any).open();
    await flushPromises();

    await setDocValue('textarea#desc', 'Too short');
    await setDocValue('#loc', 'Hartford, CT');
    await setDocValue('#title', 'Valid Title Here');

    const submitBtn = findDocButton('Submit');
    expect(submitBtn).not.toBeNull();
    expect(submitBtn?.disabled).toBe(true);
  });

  it('submit button is enabled when all fields are valid', async () => {
    const store = createMockStore();
    const wrapper = mountModal(store);

    (wrapper.vm as any).open();
    await flushPromises();

    await setDocValue('textarea#desc', 'Looking for 10 Silkie hens near Hartford CT area');
    await setDocValue('#loc', 'Hartford, CT');
    await setDocValue('#title', '3 Buff Orpington Hens');

    const submitBtn = findDocButton('Submit');
    expect(submitBtn?.disabled).toBe(false);
  });

  it('dispatches createDraftClassified with correct fields on valid submit', async () => {
    const store = createMockStore();
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    const wrapper = mountModal(store);

    (wrapper.vm as any).open();
    await flushPromises();

    await setDocValue('#cat', 'for_sale');
    await setDocValue('#loc', 'Lebanon, CT');
    await setDocValue('#title', '6 Buff Orpington Pullets');
    await setDocValue('textarea#desc', 'Selling 6 Buff Orpington pullets ready to lay');

    const submitBtn = findDocButton('Submit');
    expect(submitBtn).not.toBeNull();
    submitBtn!.click();
    await flushPromises();

    expect(dispatchSpy).toHaveBeenCalledWith('createDraftClassified', expect.objectContaining({
      category: 'for_sale',
      location: 'Lebanon, CT',
      title: '6 Buff Orpington Pullets',
      description: 'Selling 6 Buff Orpington pullets ready to lay',
    }));
  });

  describe('image upload', () => {
    it('shows a preview when a valid image is selected', async () => {
      const store = createMockStore();
      const wrapper = mountModal(store);
      (wrapper.vm as any).open();
      await flushPromises();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['mock content'], 'test.jpg', { type: 'image/jpeg' });
      
      const fileList = {
        0: file,
        length: 1,
        item: (_index: number) => file,
      };

      Object.defineProperty(fileInput, 'files', { value: fileList });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await flushPromises();

      const previewImg = document.querySelector('img.img-fluid') as HTMLImageElement;
      expect(previewImg).not.toBeNull();
      expect(previewImg.src).toBe('blob:mock-url');
    });

    it('removes preview and file when remove button is clicked', async () => {
      const store = createMockStore();
      const wrapper = mountModal(store);
      (wrapper.vm as any).open();
      await flushPromises();

      (wrapper.vm as any).imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      await flushPromises();

      expect(document.querySelector('img.img-fluid')).not.toBeNull();

      const removeBtn = findDocButton('Remove');
      removeBtn?.click();
      await flushPromises();

      expect(document.querySelector('img.img-fluid')).toBeNull();
      expect((wrapper.vm as any).imageFile).toBeNull();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('uploads image and includes URL in submission', async () => {
      const store = createMockStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const wrapper = mountModal(store);
      (wrapper.vm as any).open();
      await flushPromises();

      await setDocValue('#loc', 'Hartford, CT');
      await setDocValue('#title', 'Valid Title');
      await setDocValue('textarea#desc', 'Valid description at least 20 chars long');
      
      (wrapper.vm as any).imageFile = new File(['data'], 'test.png', { type: 'image/png' });
      await flushPromises();

      const submitBtn = findDocButton('Submit');
      submitBtn?.click();
      await flushPromises();

      expect(dispatchSpy).toHaveBeenCalledWith('createDraftClassified', expect.objectContaining({
        image_url: 'https://mock-storage.com/image.jpg'
      }));
    });

    it('rejects files larger than 10MB', async () => {
      const store = createMockStore();
      const wrapper = mountModal(store);
      (wrapper.vm as any).open();
      await flushPromises();

      const largeFile = new File([''], 'big.jpg', { type: 'image/jpeg' });
      Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });

      (wrapper.vm as any).imageFile = largeFile;
      await flushPromises();

      expect((wrapper.vm as any).imageFile).toBeNull();
    });

    it('rejects non-image files', async () => {
      const store = createMockStore();
      const wrapper = mountModal(store);
      (wrapper.vm as any).open();
      await flushPromises();

      const pdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });

      (wrapper.vm as any).imageFile = pdfFile;
      await flushPromises();

      expect((wrapper.vm as any).imageFile).toBeNull();
    });

    it('deletes uploaded image when createDraftClassified fails (orphan cleanup)', async () => {
      const store = createMockStore();
      const dispatchSpy = vi.spyOn(store, 'dispatch').mockImplementation((action: string) => {
        if (action === 'createDraftClassified') return Promise.reject(new Error('Firestore write failed'));
        return Promise.resolve();
      });

      const wrapper = mountModal(store);
      (wrapper.vm as any).open();
      await flushPromises();

      await setDocValue('#loc', 'Hartford, CT');
      await setDocValue('#title', 'Valid Title');
      await setDocValue('textarea#desc', 'Valid description at least 20 chars long');

      (wrapper.vm as any).imageFile = new File(['data'], 'test.png', { type: 'image/png' });
      await flushPromises();

      const submitBtn = findDocButton('Submit');
      submitBtn?.click();
      await flushPromises();

      expect(dispatchSpy).toHaveBeenCalledWith('createDraftClassified', expect.anything());
      expect(mockDeleteObject).toHaveBeenCalledWith('mock-ref');
    });
  });
});
