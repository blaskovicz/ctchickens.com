<script setup lang="ts">
import { useBreederUtils } from '../composables/useBreederUtils';
import { BButton } from 'bootstrap-vue-next';

const props = defineProps<{
  breederName: string;
  showLabelOnMobile?: boolean;
  variant?: any;
  size?: any;
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
    <i class="bi bi-person-circle"></i>
    <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">Profile</span>
  </BButton>
</template>
