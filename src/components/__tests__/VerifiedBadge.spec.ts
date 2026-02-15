import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import VerifiedBadge from '../VerifiedBadge.vue';

describe('VerifiedBadge', () => {
  it('renders when verified is "true" string', () => {
    const wrapper = mount(VerifiedBadge, {
      props: { verified: "true" }
    });
    expect(wrapper.find('.badge').exists()).toBe(true);
    expect(wrapper.text()).toContain('Verified');
  });

  it('renders when verified is a number 1', () => {
    const wrapper = mount(VerifiedBadge, {
      props: { verified: 1 }
    });
    expect(wrapper.find('.badge').exists()).toBe(true);
  });

  it('does not render when verified is "false" string', () => {
    const wrapper = mount(VerifiedBadge, {
      props: { verified: "false" }
    });
    expect(wrapper.find('.badge').exists()).toBe(false);
  });

  it('does not render when verified is empty string', () => {
    const wrapper = mount(VerifiedBadge, {
      props: { verified: "" }
    });
    expect(wrapper.find('.badge').exists()).toBe(false);
  });

  it('renders when verified is boolean true', () => {
    const wrapper = mount(VerifiedBadge, {
      props: { verified: true as any }
    });
    expect(wrapper.find('.badge').exists()).toBe(true);
  });

  it('does not render when verified is null', () => {
    const wrapper = mount(VerifiedBadge, {
      props: { verified: null as any }
    });
    expect(wrapper.find('.badge').exists()).toBe(false);
  });
});
