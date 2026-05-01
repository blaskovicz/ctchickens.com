<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { BBadge } from 'bootstrap-vue-next';
import type { Classified, DraftClassified } from '../types';
import { CATEGORY_LABELS, CATEGORY_VARIANTS } from '../types';
import { formatRelativeTime } from '../composables/useBreederUtils';

const props = defineProps<{
  item: Classified | DraftClassified;
  showOwnerLabel?: boolean;
}>();

const store = useStore();
const router = useRouter();

const isPending = props.item.status === 'pending';
const isExpired = props.item.status === 'expired';
const isOwner = store.state.user?.uid === props.item.owner_uid;

const verifiedFarms = computed(() =>
  ((store.state.breeders as any[]) ?? []).filter(b => b.ownerUid === props.item.owner_uid && b.verified)
);
</script>

<template>
  <div class="card h-100 border-0 shadow-sm overflow-hidden classified-card" style="cursor:pointer;" @click="router.push(`/classified/${item.id}`)">
    <div v-if="item.image_url" class="classified-thumbnail-wrapper">
      <img :src="item.image_url" class="card-img-top classified-thumbnail" :class="{ 'expired-img': isExpired }" alt="Classified photo" />
      <div v-if="isPending" class="pending-overlay">
        <div class="badge bg-warning text-dark px-3 py-2 shadow-sm animate-pulse">
          <i class="bi bi-file-earmark-check me-1"></i> Pending Approval
        </div>
      </div>
      <div v-else-if="isExpired" class="pending-overlay">
        <div class="badge bg-secondary text-white px-3 py-2 shadow-sm">
          <i class="bi bi-clock-history me-1"></i> Expired
        </div>
      </div>
    </div>
    <div v-else-if="isPending" class="pending-no-image p-3 text-center bg-light border-bottom">
      <div class="badge bg-warning text-dark px-3 py-2 shadow-sm animate-pulse">
        <i class="bi bi-file-earmark-check me-1"></i> Pending Approval
      </div>
    </div>
    <div v-else-if="isExpired" class="pending-no-image p-3 text-center bg-light border-bottom">
      <div class="badge bg-secondary text-white px-3 py-2 shadow-sm">
        <i class="bi bi-clock-history me-1"></i> Expired
      </div>
    </div>

    <div class="card-body d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <BBadge :variant="CATEGORY_VARIANTS[item.category]" pill>
          {{ CATEGORY_LABELS[item.category] }}
        </BBadge>
        <span v-if="item.price" class="text-success fw-semibold small ms-auto">{{ item.price }}</span>
      </div>
      
      <p class="card-title fw-semibold text-dark mb-1 line-clamp-2">
        {{ item.title }}
      </p>
      
      <p class="card-text text-muted small mb-2 line-clamp-2">
        <span v-if="item.description">{{ item.description }}</span>
        <span v-else class="fst-italic opacity-50">Inquire for more info</span>
      </p>
      
      <div class="mt-auto">
        <div class="d-flex align-items-center gap-1 text-muted small">
          <i class="bi bi-geo-alt"></i>
          <span class="text-truncate">{{ item.location }}</span>
          <span class="mx-1">·</span>
          <i class="bi bi-person"></i>
          <span class="text-truncate">
            {{ item.display_name }}<span v-if="showOwnerLabel && isOwner" class="text-muted"> (you)</span>
          </span>
        </div>
        <div class="text-muted smaller mt-1">
          <i class="bi bi-clock me-1"></i>{{ formatRelativeTime(item.created_at) }}
        </div>
        <div v-if="verifiedFarms.length" class="mt-1">
          <div v-for="farm in verifiedFarms" :key="farm.id" class="d-flex align-items-center gap-1 small">
            <i class="bi bi-patch-check-fill text-success"></i>
            <router-link :to="`/directory/${farm.id}`" class="text-success fw-semibold text-truncate farm-link" @click.stop>
              {{ farm.name }}
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.classified-card {
  transition: transform 0.25s ease-in-out, box-shadow 0.25s ease-in-out;
}
.classified-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.1) !important;
}

.classified-thumbnail-wrapper {
  height: 180px;
  overflow: hidden;
  background-color: #f8f9fa;
  position: relative;
}

.classified-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.classified-card:hover .classified-thumbnail {
  transform: scale(1.05);
}

.pending-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.expired-img {
  filter: grayscale(80%) opacity(0.6);
}

.pending-no-image {
  min-height: 56px;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.smaller {
  font-size: 0.75rem;
}

.farm-link {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.farm-link:hover {
  opacity: 0.8;
}

@keyframes pulse-soft {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
.animate-pulse {
  animation: pulse-soft 2s infinite ease-in-out;
}
</style>
