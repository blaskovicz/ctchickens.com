import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FoundingBreederBadge from '../FoundingBreederBadge.vue';

describe('FoundingBreederBadge', () => {
  it('renders when count is a positive number', () => {
    const wrapper = mount(FoundingBreederBadge, {
      props: { count: 1 }
    });
    expect(wrapper.find('.badge').exists()).toBe(true);
    expect(wrapper.text()).toContain('Founding Breeder');
  });

  it('does not render when count is 0', () => {
    const wrapper = mount(FoundingBreederBadge, {
      props: { count: 0 }
    });
    expect(wrapper.find('.badge').exists()).toBe(false);
  });

  it('renders when count is "1"', () => {
    const wrapper = mount(FoundingBreederBadge, {
      props: { count: "1" }
    });
    expect(wrapper.find('.badge').exists()).toBe(true);
  });

  it('does not render when count is "0"', () => {
    const wrapper = mount(FoundingBreederBadge, {
      props: { count: "0" }
    });
    expect(wrapper.find('.badge').exists()).toBe(false);
  });

  it('does not render when count is empty string', () => {
    const wrapper = mount(FoundingBreederBadge, {
      props: { count: "" }
    });
    expect(wrapper.find('.badge').exists()).toBe(false);
  });

  it('does not render when count is "false"', () => {
    const wrapper = mount(FoundingBreederBadge, {
      props: { count: "false" }
    });
    expect(wrapper.find('.badge').exists()).toBe(false);
  });

  it('renders when count is boolean true', () => {
    // Note: We removed boolean from types to fix empty string casting, 
    // but the component logic still handles truthy values.
    const wrapper = mount(FoundingBreederBadge, {
      props: { count: true as any }
    });
    expect(wrapper.find('.badge').exists()).toBe(true);
  });

  it('does not render when count is null', () => {
    const wrapper = mount(FoundingBreederBadge, {
      props: { count: null as any }
    });
    expect(wrapper.find('.badge').exists()).toBe(false);
  });
});
