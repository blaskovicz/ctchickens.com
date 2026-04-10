import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createStore } from 'vuex';
import ContactButton from '../ContactButton.vue';

describe('ContactButton', () => {
  const createMockStore = () => {
    return createStore({
      actions: {
        toggleInquiryModal: vi.fn()
      }
    });
  };

  it('renders a mailto link correctly for verified members', () => {
    const store = createMockStore();
    const wrapper = mount(ContactButton, {
      global: { plugins: [store] },
      props: { 
        link: 'test@example.com',
        breeder: { name: 'Verified Farm', verified: true } as any
      }
    });
    const a = wrapper.find('a');
    expect(a.exists()).toBe(true);
    expect(a.attributes('href')).toContain('mailto:test@example.com');
  });

  it('renders a Message button for unverified members', () => {
    const store = createMockStore();
    const wrapper = mount(ContactButton, {
      global: { plugins: [store] },
      props: { 
        link: 'test@example.com',
        breeder: { name: 'Unverified Farm', verified: false } as any
      }
    });
    const btn = wrapper.find('button');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('Message');
  });

  it('triggers toggleInquiryModal when Message button is clicked', async () => {
    const store = createMockStore();
    const toggleSpy = vi.spyOn(store, 'dispatch');
    const breeder = { id: 'un-farm', name: 'Unverified Farm', verified: false } as any;
    
    const wrapper = mount(ContactButton, {
      global: { plugins: [store] },
      props: { 
        link: 'test@example.com',
        breeder
      }
    });
    
    await wrapper.find('button').trigger('click');
    expect(toggleSpy).toHaveBeenCalledWith('toggleInquiryModal', { show: true, breeder });
  });

  it('falls back to direct link if breeder prop is missing (backward compatibility)', () => {
    const store = createMockStore();
    const wrapper = mount(ContactButton, {
      global: { plugins: [store] },
      props: { 
        link: 'https://example.com'
      }
    });
    const a = wrapper.find('a');
    expect(a.exists()).toBe(true);
    expect(a.attributes('href')).toBe('https://example.com');
  });

  it('disables Message button if user is blocked from chat', () => {
    const store = createStore({
      state: {
        user: { uid: 'user-1' },
        userData: { blockedFromChat: true }
      },
      actions: { toggleInquiryModal: vi.fn() }
    });
    
    const wrapper = mount(ContactButton, {
      global: { plugins: [store] },
      props: { 
        link: 'test@example.com',
        breeder: { name: 'Farm', verified: false } as any
      }
    });
    
    const btn = wrapper.find('button');
    expect(btn.element.disabled).toBe(true);
    expect(btn.attributes('title')).toBe('Messaging Restricted');
  });

  it('hides the component if the user is the owner of the farm', () => {
    const store = createStore({
      state: {
        user: { uid: 'owner-1' },
        userData: {}
      }
    });
    
    const wrapper = mount(ContactButton, {
      global: { plugins: [store] },
      props: { 
        link: 'test@example.com',
        breeder: { ownerUid: 'owner-1' } as any
      }
    });
    
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.find('a').exists()).toBe(false);
  });
});
