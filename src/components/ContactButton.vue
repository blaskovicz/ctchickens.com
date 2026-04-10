<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useBreederUtils } from '../composables/useBreederUtils';
import type { Breeder } from '../types';

const props = defineProps<{
  link: string | null;
  breeder?: Breeder;
  showLabelOnMobile?: boolean;
}>();

const store = useStore();
const { formatContactLink } = useBreederUtils();

const user = computed(() => store.state.user);
const userData = computed(() => store.state.userData);
const isBlocked = computed(() => userData.value?.blockedFromChat === true);
const isOwner = computed(() => user.value && props.breeder?.ownerUid === user.value.uid);

const handleSecureMessage = () => {
  if (isBlocked.value) return;
  if (props.breeder) {
    store.dispatch('toggleInquiryModal', { show: true, breeder: props.breeder });
  }
};
</script>

<template>
  <div v-if="!isOwner">
    <!-- Case 1: Verified Member (Direct Email or Link) -->
    <a
      v-if="link && (!breeder || breeder.verified)"
      target="_blank"
      :href="formatContactLink(link)!"
      class="btn btn-sm btn-primary text-nowrap d-inline-flex align-items-center justify-content-center"
      style="min-width: 36px;"
    >
      <i class="bi bi-envelope-fill text-center" :class="showLabelOnMobile ? 'me-2' : 'me-lg-2'"></i>
      <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">Contact</span>
    </a>

    <!-- Case 2: Unverified Member (Secure Inquiry Bridge) -->
    <button
      v-else-if="breeder"
      @click="handleSecureMessage"
      class="btn btn-sm btn-outline-primary text-nowrap d-inline-flex align-items-center justify-content-center"
      style="min-width: 36px;"
      :class="{ 'opacity-50': isBlocked }"
      :disabled="isBlocked"
      :title="isBlocked ? 'Messaging Restricted' : 'Message via CTChickens (Secure)'"
    >
      <i class="bi bi-chat-right-text-fill text-center" :class="showLabelOnMobile ? 'me-2' : 'me-lg-2'"></i>
      <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">Message</span>
    </button>
  </div>
</template>
