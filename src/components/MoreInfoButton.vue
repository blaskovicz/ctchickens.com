<script setup lang="ts">
import { trackEvent } from '../firebase';

const props = defineProps<{
  link: string | null;
  name: string;
  verified: boolean | string | number | null;
  showLabelOnMobile?: boolean;
}>();

const handleClick = () => {
  trackEvent('view_breeder_website', { breeder_name: props.name });
  window.open(props.link!, '_blank', 'noopener,noreferrer');
};
</script>

<template>
  <div v-if="link" class="d-inline-block">
    <a
      href="#"
      @click.prevent="handleClick"
      class="btn btn-sm btn-outline-dark text-nowrap d-inline-flex align-items-center justify-content-center"
      style="min-width: 36px;"
    >
      <i class="bi bi-info-circle text-center" :class="showLabelOnMobile ? 'me-2' : 'me-lg-2'"></i>
      <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">View Website</span>
    </a>
  </div>
</template>
