<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import ClassifiedCard from './ClassifiedCard.vue';
import type { Classified } from '../types';

const props = defineProps<{ ownerUid: string; isOwner?: boolean; isAdmin?: boolean }>();

const classifieds = ref<Classified[]>([]);
const isLoading = ref(true);
const canSeeExpired = computed(() => props.isOwner || props.isAdmin);

const activeClassifieds = computed(() => classifieds.value.filter(c => c.status === 'active'));
const expiredClassifieds = computed(() => classifieds.value.filter(c => c.status === 'expired'));

onMounted(async () => {
  try {
    const statusFilter = canSeeExpired.value
      ? where('status', 'in', ['active', 'expired'])
      : where('status', '==', 'active');
    const q = query(
      collection(db, 'classifieds'),
      where('owner_uid', '==', props.ownerUid),
      statusFilter,
      orderBy('created_at', 'desc')
    );
    const snap = await getDocs(q);
    classifieds.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classified));
  } catch (e) {
    console.error('Error fetching breeder classifieds:', e);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div v-if="isLoading" class="text-center py-3">
    <div class="spinner-border spinner-border-sm text-muted" role="status" />
  </div>
  <template v-else-if="classifieds.length">
    <!-- Active classifieds -->
    <div v-if="activeClassifieds.length" class="row g-3">
      <div v-for="item in activeClassifieds" :key="item.id" class="col-md-6 col-lg-4">
        <ClassifiedCard :item="item" />
      </div>
    </div>

    <!-- Expired classifieds (owner/admin only) -->
    <div v-if="expiredClassifieds.length && canSeeExpired" :class="{ 'mt-4': activeClassifieds.length }">
      <div class="d-flex align-items-center gap-2 mb-3">
        <h6 class="text-muted text-uppercase small fw-bold mb-0 letter-spacing-1">Expired</h6>
        <hr class="flex-grow-1 my-0 opacity-10">
      </div>
      <div class="row g-3">
        <div v-for="item in expiredClassifieds" :key="item.id" class="col-md-6 col-lg-4">
          <ClassifiedCard :item="item" />
        </div>
      </div>
    </div>
  </template>
  <div v-else-if="isOwner" class="text-center py-3">
    <p class="text-muted small mb-2">You haven't posted any classifieds yet.</p>
    <router-link to="/classified/new" class="btn btn-sm btn-outline-primary">
      <i class="bi bi-plus-lg me-1"></i> Post a Classified
    </router-link>
  </div>
</template>

<style scoped>
.letter-spacing-1 {
  letter-spacing: 0.05rem;
}
</style>
