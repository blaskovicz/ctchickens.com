<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useBreederUtils } from '../composables/useBreederUtils';
import { trackEvent } from '../firebase';
import type { Breeder } from '../types';

const props = withDefaults(defineProps<{
  link: string | null;
  breeder?: Breeder;
  showLabelOnMobile?: boolean;
  forceSecureOnly?: boolean;
  variant?: string;
  directVariant?: string;
  size?: string;
}>(), {
  showLabelOnMobile: false,
  forceSecureOnly: false,
  variant: 'outline-primary',
  directVariant: 'outline-dark',
  size: 'sm'
});

const store = useStore();
const { formatContactLink } = useBreederUtils();

const user = computed(() => store.state.user);
const userData = computed(() => store.state.userData);
const isBlocked = computed(() => userData.value?.blockedFromChat === true);
const isOwner = computed(() => user.value && props.breeder?.ownerUid === user.value.uid);

const isVerified = computed(() => {
  // If breeder prop is missing, we assume verified for backward compatibility
  if (!props.breeder) return true;
  
  const val = props.breeder.verified;
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') {
    const s = (val as string).trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined';
  }
  return !!val;
});

const handleSecureMessage = () => {
  if (isBlocked.value) return;
  if (props.breeder) {
    trackEvent('contact_breeder', { method: 'secure_message', breeder_id: props.breeder.id });
    store.dispatch('toggleInquiryModal', { show: true, breeder: props.breeder });
  }
};

const handleDirectContact = () => {
  if (props.breeder) {
    trackEvent('contact_breeder', { method: 'direct_contact', breeder_id: props.breeder.id });
  }
};
</script>

<template>
  <div v-if="!isOwner" class="d-inline-flex gap-2">
    <!-- 1. The Message Breeder Button (Always available unless it's the owner) -->
    <button
      @click="handleSecureMessage"
      class="btn text-nowrap d-inline-flex align-items-center justify-content-center"
      style="min-width: 36px;"
      :class="[
        variant ? `btn-${variant}` : 'btn-outline-primary', 
        size ? `btn-${size}` : 'btn-sm',
        { 'opacity-50': isBlocked }
      ]"
      :disabled="isBlocked"
      :title="isBlocked ? 'Messaging Restricted' : 'Message Breeder via CTChickens'"
    >
      <i class="bi bi-chat-dots-fill text-center" :class="showLabelOnMobile ? 'me-2' : 'me-lg-2'"></i>
      <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">Message</span>
    </button>

    <!-- 2. Direct Contact (Only if verified AND not forced to secure only) -->
    <a
      v-if="link && isVerified && !forceSecureOnly"
      target="_blank"
      :href="formatContactLink(link)!"
      @click="handleDirectContact"
      class="btn text-nowrap d-inline-flex align-items-center justify-content-center"
      style="min-width: 36px;"
      :class="[
        directVariant ? `btn-${directVariant}` : 'btn-outline-dark',
        size ? `btn-${size}` : 'btn-sm'
      ]"
      title="Direct Contact"
    >
      <i class="bi bi-envelope-fill text-center" :class="showLabelOnMobile ? 'me-2' : 'me-lg-2'"></i>
      <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">{{formatContactLink(link).startsWith('mailto:') ? 'Email' : 'Contact Me'}}</span>
    </a>
  </div>
</template>
