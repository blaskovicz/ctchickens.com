<script setup lang="ts">
import { computed } from 'vue';
import { vBTooltip } from 'bootstrap-vue-next';

const props = defineProps<{
  verified?: string | number | boolean | null
}>();

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
    v-b-tooltip.hover="'A confirmed, known member of our community in good standing.'"
    class="badge bg-success d-inline-flex align-items-center me-1"
    style="cursor: help;"
  >
    <i class="bi bi-check-circle-fill me-1"></i>Verified
  </span>
</template>
