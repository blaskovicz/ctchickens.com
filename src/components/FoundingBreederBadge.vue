<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  count?: number | string | null
}>();

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
  <span v-if="show" class="badge bg-primary d-inline-flex align-items-center me-1">
    <i class="bi bi-award-fill me-1"></i>Founding Breeder
  </span>
</template>
