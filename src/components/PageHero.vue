<script setup lang="ts">
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: '' },
  centered: { type: Boolean, default: false },
  badgeText: { type: String, default: 'Connecticut' },
  lead: { type: Boolean, default: true }
});
</script>

<template>
  <div class="page-hero p-4 p-md-5 text-white position-relative mb-0">
    <div class="container position-relative z-1">
      <div 
        class="d-flex flex-column gap-3"
        :class="[
          centered ? 'text-center align-items-center' : 'flex-md-row align-items-center align-items-md-end justify-content-between'
        ]"
      >
        <div :class="{ 'text-center text-md-start': !centered, 'text-center': centered }">
          <div 
            class="d-flex align-items-center gap-2 mb-2"
            :class="{ 'justify-content-center justify-content-md-start': !centered, 'justify-content-center': centered }"
          >
            <i v-if="icon" :class="['bi', icon, 'fs-4 text-white opacity-75']"></i>
            <span class="badge bg-white text-primary px-3 py-1 small fw-bold shadow-sm">{{ badgeText }}</span>
          </div>
          <h1 class="display-5 fw-bold text-white mb-2">{{ title }}</h1>
          <p 
            class="text-white opacity-75 mb-0" 
            :class="{ 'lead': lead, 'mx-auto': centered }"
            :style="{ maxWidth: centered ? '700px' : '520px' }"
          >
            {{ description }}
          </p>
        </div>
        <div v-if="$slots.actions" class="flex-shrink-0">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-hero {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
}
.page-hero::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  pointer-events: none;
}
</style>
