<script setup lang="ts">
import { computed } from 'vue';
import { vBTooltip } from 'bootstrap-vue-next';

const props = defineProps<{
  verified?: string | number | boolean | null;
  variant?: string;
}>();

const variantClass = computed(() => `bg-${props.variant || 'success'}`);

const show = computed(() => {
  const val = props.verified;
  if (val === null || val === undefined || val === false) return false;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined';
  }
  return !!val;
});
</script>

<template>
  <span 
    v-if="show" 
    class="badge d-inline-flex align-items-center"
    :class="variantClass"
    style="cursor: help;"
  >
    <span v-b-tooltip.hover="'Verified listings confirm the breeder is a known member of our community in good standing.'" class="d-inline-flex align-items-center">
      <i class="bi bi-check-circle-fill me-1"></i>Verified
    </span>
  </span>
</template>
