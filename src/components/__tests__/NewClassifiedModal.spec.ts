import { describe, it, expect, vi } from 'vitest';
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
      loginWithFacebook: vi.fn(),
    },
  });

describe('NewClassifiedModal', () => {
  it('submit button is disabled when description is less than 20 characters', async () => {
    const store = createMockStore();
    const wrapper = mount(NewClassifiedModal, { global: { plugins: [store] } });

    // Open the modal
    (wrapper.vm as any).open();
    await flushPromises();

    // Set a short description (< 20 chars)
    const textarea = wrapper.find('textarea');
    await textarea.setValue('Too short');

    // Location and title must be valid so only description triggers invalidity
    const locInput = wrapper.find('#loc');
    await locInput.setValue('Hartford, CT');
    const titleInput = wrapper.find('#title');
    await titleInput.setValue('Valid Title Here');

    const submitBtn = wrapper.findAll('button').find(b => b.text().includes('Submit'));
    expect(submitBtn?.element.disabled).toBe(true);
  });

  it('submit button is disabled when location is less than 2 characters', async () => {
    const store = createMockStore();
    const wrapper = mount(NewClassifiedModal, { global: { plugins: [store] } });

    (wrapper.vm as any).open();
    await flushPromises();

    const textarea = wrapper.find('textarea');
    await textarea.setValue('A long enough description that is at least 20 chars');

    const locInput = wrapper.find('#loc');
    await locInput.setValue('X');
    const titleInput = wrapper.find('#title');
    await titleInput.setValue('Valid Title Here');

    const submitBtn = wrapper.findAll('button').find(b => b.text().includes('Submit'));
    expect(submitBtn?.element.disabled).toBe(true);
  });

  it('submit button is disabled when title is less than 5 characters', async () => {
    const store = createMockStore();
    const wrapper = mount(NewClassifiedModal, { global: { plugins: [store] } });

    (wrapper.vm as any).open();
    await flushPromises();

    await wrapper.find('textarea').setValue('A long enough description that is at least 20 chars');
    await wrapper.find('#loc').setValue('Hartford, CT');
    await wrapper.find('#title').setValue('Hi');

    const submitBtn = wrapper.findAll('button').find(b => b.text().includes('Submit'));
    expect(submitBtn?.element.disabled).toBe(true);
  });

  it('submit button is enabled when all fields are valid', async () => {
    const store = createMockStore();
    const wrapper = mount(NewClassifiedModal, { global: { plugins: [store] } });

    (wrapper.vm as any).open();
    await flushPromises();

    await wrapper.find('textarea').setValue('Looking for 10 Silkie hens near Hartford CT area');
    await wrapper.find('#loc').setValue('Hartford, CT');
    await wrapper.find('#title').setValue('3 Buff Orpington Hens');

    const submitBtn = wrapper.findAll('button').find(b => b.text().includes('Submit'));
    expect(submitBtn?.element.disabled).toBe(false);
  });

  it('shows character counter in danger class when description is below minimum', async () => {
    const store = createMockStore();
    const wrapper = mount(NewClassifiedModal, { global: { plugins: [store] } });

    (wrapper.vm as any).open();
    await flushPromises();

    await wrapper.find('textarea').setValue('Short');
    const counter = wrapper.find('.text-danger');
    expect(counter.exists()).toBe(true);
    expect(counter.text()).toContain('5');
  });

  it('dispatches createDraftClassified with correct fields on valid submit', async () => {
    const store = createMockStore();
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    const wrapper = mount(NewClassifiedModal, { global: { plugins: [store] } });

    (wrapper.vm as any).open();
    await flushPromises();

    await wrapper.find('#cat').setValue('for_sale');
    await wrapper.find('#loc').setValue('Lebanon, CT');
    await wrapper.find('#title').setValue('6 Buff Orpington Pullets');
    await wrapper.find('#desc').setValue('Selling 6 Buff Orpington pullets ready to lay');

    const submitBtn = wrapper.findAll('button').find(b => b.text().includes('Submit'));
    await submitBtn!.trigger('click');
    await flushPromises();

    expect(dispatchSpy).toHaveBeenCalledWith('createDraftClassified', {
      category: 'for_sale',
      location: 'Lebanon, CT',
      title: '6 Buff Orpington Pullets',
      description: 'Selling 6 Buff Orpington pullets ready to lay',
    });
  });

  it('shows login prompt when user is not signed in', async () => {
    const store = createMockStore(false);
    const wrapper = mount(NewClassifiedModal, { global: { plugins: [store] } });

    (wrapper.vm as any).open();
    await flushPromises();

    expect(wrapper.text()).toContain('signed in to post');
  });

  it('emits "submitted" event with the new doc id after successful submission', async () => {
    const store = createMockStore();
    const wrapper = mount(NewClassifiedModal, { global: { plugins: [store] } });

    (wrapper.vm as any).open();
    await flushPromises();

    await wrapper.find('#loc').setValue('Storrs, CT');
    await wrapper.find('#title').setValue('5 Heritage Breed Roosters');
    await wrapper.find('#desc').setValue('Looking for 5 heritage breed roosters for breeding stock');

    const submitBtn = wrapper.findAll('button').find(b => b.text().includes('Submit'));
    await submitBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.emitted('submitted')).toBeTruthy();
    expect(wrapper.emitted('submitted')![0]).toEqual(['new-doc-id']);
  });
});
