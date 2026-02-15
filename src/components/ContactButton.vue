<script setup lang="ts">
import { useBreederUtils } from '../composables/useBreederUtils';

defineProps<{
  link: string | null;
  showLabelOnMobile?: boolean;
}>();

const { formatContactLink } = useBreederUtils();
</script>

<template>
  <a 
    v-if="link"
    target="_blank"
    :href="formatContactLink(link)!" 
    class="btn btn-sm btn-primary text-nowrap"
  >
    <i class="bi bi-envelope-fill" :class="showLabelOnMobile ? 'me-2' : 'me-lg-2'"></i>
    <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">Contact</span>
  </a>
</template>
