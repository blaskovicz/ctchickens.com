<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useBreederUtils } from '../composables/useBreederUtils';
import type { Breeder } from '../types';

const props = defineProps<{
  link: string | null;
  breeder?: Breeder;
  showLabelOnMobile?: boolean;
  forceSecureOnly?: boolean;
}>();

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
    store.dispatch('toggleInquiryModal', { show: true, breeder: props.breeder });
  }
};
</script>

<template>
  <div v-if="!isOwner" class="d-inline-flex gap-2">
    <!-- 1. The Secure Message Button (Always available unless it's the owner) -->
    <button
      @click="handleSecureMessage"
      class="btn btn-sm btn-outline-primary text-nowrap d-inline-flex align-items-center justify-content-center"
      style="min-width: 36px;"
      :class="{ 'opacity-50': isBlocked }"
      :disabled="isBlocked"
      :title="isBlocked ? 'Messaging Restricted' : 'Secure Message via CTChickens'"
    >
      <i class="bi bi-lock-fill text-center" :class="showLabelOnMobile ? 'me-2' : 'me-lg-2'"></i>
      <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">Secure Message</span>
    </button>

    <!-- 2. Direct Contact (Only if verified AND not forced to secure only) -->
    <a
      v-if="link && isVerified && !forceSecureOnly"
      target="_blank"
      :href="formatContactLink(link)!"
      class="btn btn-sm btn-outline-dark text-nowrap d-inline-flex align-items-center justify-content-center"
      style="min-width: 36px;"
      title="Direct Contact"
    >
      <i class="bi bi-envelope-fill text-center" :class="showLabelOnMobile ? 'me-2' : 'me-lg-2'"></i>
      <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">{{formatContactLink(link).startsWith('mailto:') ? 'Email' : 'Contact Me'}}</span>
    </a>
  </div>
</template>
