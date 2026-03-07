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
const defaultIconClass = "bi bi-link-45deg ms-1 text-muted";
const defaultIconStyle = "font-size: 1.2rem; line-height: inherit; margin-top: -0.1em;";

const computedLinkClass = computed(() => props.linkClass || defaultLinkClass);
const computedIconClass = computed(() => props.iconClass || defaultIconClass);
const computedIconStyle = computed(() => props.iconStyle || defaultIconStyle);
</script>

<template>
  <router-link 
    v-if="verified" 
    :to="`/directory/${generateSlug(name)}`" 
    :class="computedLinkClass"
  >
    {{ displayName || name }}
    <i :class="computedIconClass" :style="computedIconStyle" title="View Profile Permalink"></i>
  </router-link>
  <span v-else>{{ displayName || name }}</span>
</template>