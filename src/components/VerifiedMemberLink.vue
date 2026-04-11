<script setup lang="ts">
import { computed } from 'vue';
import { useBreederUtils } from '../composables/useBreederUtils';

const props = defineProps<{
  name: string;
  displayName?: string;
  verified: boolean | string | number | null;
  linkClass?: string;
  iconClass?: string;
  iconStyle?: string;
}>();

const { generateSlug } = useBreederUtils();

const defaultLinkClass = "text-decoration-none text-dark d-flex align-items-start";

const computedLinkClass = computed(() => props.linkClass || defaultLinkClass);
</script>

<template>
  <router-link 
    :to="`/directory/${generateSlug(name)}`" 
    :class="computedLinkClass"
  >
    {{ displayName || name }}
  </router-link>
</template>