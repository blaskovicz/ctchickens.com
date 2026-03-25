import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ContactButton from '../ContactButton.vue';

describe('ContactButton', () => {
  it('renders a mailto link correctly for raw emails', () => {
    const wrapper = mount(ContactButton, {
      props: { link: 'test@example.com' }
    });
    const a = wrapper.find('a');
    expect(a.exists()).toBe(true);
    expect(a.attributes('href')).toBe('mailto:test@example.com?subject=Inquiry%20from%20ctchickens.com');
  });

  it('renders a standard URL correctly', () => {
    const wrapper = mount(ContactButton, {
      props: { link: 'https://example.com' }
    });
    const a = wrapper.find('a');
    expect(a.exists()).toBe(true);
    expect(a.attributes('href')).toBe('https://example.com');
  });

  it('does not render if link is null', () => {
    const wrapper = mount(ContactButton, {
      props: { link: null }
    });
    expect(wrapper.find('a').exists()).toBe(false);
  });
});
