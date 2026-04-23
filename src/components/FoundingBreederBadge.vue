<script setup lang="ts">
import { computed } from 'vue';
import { vBTooltip } from 'bootstrap-vue-next';

const props = defineProps<{
  count?: number | string | null;
  variant?: string;
}>();

const variantClass = computed(() => `bg-${props.variant || 'primary'}`);

const show = computed(() => {
  const val = props.count;
  if (val === null || val === undefined) return false;
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
    <span v-b-tooltip.hover="'Reserved for verified members that joined the directory during the first launch year.'" class="d-inline-flex align-items-center">
      <i class="bi bi-award-fill me-1"></i>Founding Member #{{ count }}
    </span>
  </span>
</template>
