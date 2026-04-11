<script setup lang="ts">
import { useBreederUtils } from '../composables/useBreederUtils';
import { BButton } from 'bootstrap-vue-next';

const props = defineProps<{
  breederName: string;
  showLabelOnMobile?: boolean;
  variant?: string;
  size?: string;
}>();

const { generateSlug } = useBreederUtils();
</script>

<template>
  <BButton 
    :to="{ name: 'breeder-profile', params: { slug: generateSlug(breederName) } }"
    :variant="variant || 'outline-primary'" 
    :size="size || 'sm'"
    class="d-flex align-items-center gap-1"
  >
    <i class="bi bi-person-bounding-box"></i>
    <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">View Profile</span>
  </BButton>
</template>
