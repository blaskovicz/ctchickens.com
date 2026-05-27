<script setup lang="ts">
import { computed } from 'vue';
import { renderBreederDescription } from '../composables/useMessageRenderer';

const props = withDefaults(defineProps<{ text: string | null | undefined; fallback?: string }>(), {
  fallback: 'Inquire for more info',
});
const html = computed(() => props.text ? renderBreederDescription(props.text) : '');
</script>

<template>
  <div v-if="html" class="markdown-content" v-html="html" />
  <span v-else class="text-muted fst-italic">{{ fallback }}</span>
</template>

<style scoped>
.markdown-content :deep(p) { margin-bottom: 0.5rem; }
.markdown-content :deep(p:last-child) { margin-bottom: 0; }
.markdown-content :deep(ul),
.markdown-content :deep(ol) { margin-bottom: 0.5rem; padding-left: 1.25rem; }
.markdown-content :deep(li) { margin-bottom: 0.15rem; }
</style>
