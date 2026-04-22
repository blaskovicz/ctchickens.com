import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import NewClassifiedModal from '../NewClassifiedModal.vue';

const createMockStore = (isLoggedIn = true) =>
  createStore({
    state: { user: isLoggedIn ? { uid: 'user-1', displayName: 'Test User' } : null },
    getters: {
      isLoggedIn: (state: any) => !!state.user,
    },
    actions: {
      createDraftClassified: vi.fn(() => Promise.resolve('new-doc-id')),
      loginWithFacebook: vi.fn() as any,
    },
  });

/**
 * Mount NewClassifiedModal attached to document.body so that BModal's
 * <Teleport> lands inside the live document.
 *
 * BModal teleports its content directly to <body>, so wrapper.find() cannot
 * reach it. All DOM interactions use document.querySelector / getElementById
 * instead, which scans the entire document including teleported nodes.
 */
function mountModal(store: ReturnType<typeof createMockStore>) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return mount(NewClassifiedModal, {
    attachTo: div,
    global: { plugins: [store] },
  });
}

/** Helper: set value on a teleported element and trigger Vue reactivity. */
async function setDocValue(selector: string, value: string) {
  const el = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (!el) throw new Error(`setDocValue: element not found for selector "${selector}"`);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await flushPromises();
}

/** Helper: find a button anywhere in the document by its text content. */
function findDocButton(text: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(text)) as HTMLButtonElement | null;
}

describe('NewClassifiedModal', () => {
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

  it('submit button is disabled when location is less than 2 characters', async () => {
    const store = createMockStore();
    const wrapper = mountModal(store);

    (wrapper.vm as any).open();
    await flushPromises();

    await setDocValue('textarea#desc', 'A long enough description that is at least 20 chars');
    await setDocValue('#loc', 'X');
    await setDocValue('#title', 'Valid Title Here');

    const submitBtn = findDocButton('Submit');
    expect(submitBtn?.disabled).toBe(true);
  });

  it('submit button is disabled when title is less than 5 characters', async () => {
    const store = createMockStore();
    const wrapper = mountModal(store);

    (wrapper.vm as any).open();
    await flushPromises();

    await setDocValue('textarea#desc', 'A long enough description that is at least 20 chars');
    await setDocValue('#loc', 'Hartford, CT');
    await setDocValue('#title', 'Hi');

    const submitBtn = findDocButton('Submit');
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

  it('shows character counter in danger class when description is below minimum', async () => {
    const store = createMockStore();
    const wrapper = mountModal(store);

    (wrapper.vm as any).open();
    await flushPromises();

    await setDocValue('textarea#desc', 'Short');

    // The counter is inside the teleported content — query from document
    const counter = document.querySelector('.text-danger');
    expect(counter).not.toBeNull();
    expect(counter?.textContent).toContain('5');
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

  it('shows login prompt when user is not signed in', async () => {
    const store = createMockStore(false);
    const wrapper = mountModal(store);

    (wrapper.vm as any).open();
    await flushPromises();

    // Modal content is teleported to body — check full document text
    expect(document.body.textContent).toContain('signed in to post');
  });

  it('emits "submitted" event with the new doc id after successful submission', async () => {
    const store = createMockStore();
    const wrapper = mountModal(store);

    (wrapper.vm as any).open();
    await flushPromises();

    await setDocValue('#loc', 'Storrs, CT');
    await setDocValue('#title', '5 Heritage Breed Roosters');
    await setDocValue('textarea#desc', 'Looking for 5 heritage breed roosters for breeding stock');

    const submitBtn = findDocButton('Submit');
    submitBtn!.click();
    await flushPromises();

    expect(wrapper.emitted('submitted')).toBeTruthy();
    expect(wrapper.emitted('submitted')![0]).toEqual(['new-doc-id']);
  });
});
