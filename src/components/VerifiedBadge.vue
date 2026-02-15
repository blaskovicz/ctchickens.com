<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  verified?: string | number | null
}>();

const show = computed(() => {
  const val = props.verified;
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined';
  }
  return !!val;
});
</script>

<template>
  <span v-if="show" class="badge bg-success d-inline-flex align-items-center me-1">
    <i class="bi bi-check-circle-fill me-1"></i>Verified
  </span>
</template>
