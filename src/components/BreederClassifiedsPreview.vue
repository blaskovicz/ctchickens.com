<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import ClassifiedCard from './ClassifiedCard.vue';
import type { Classified, DraftClassified } from '../types';

const props = defineProps<{ ownerUid: string; isOwner?: boolean; isAdmin?: boolean }>();

const classifieds = ref<Classified[]>([]);
const pendingClassifieds = ref<DraftClassified[]>([]);
const isLoading = ref(true);
const canSeePrivate = computed(() => props.isOwner || props.isAdmin);

const activeClassifieds = computed(() => classifieds.value.filter(c => c.status === 'active'));
const expiredClassifieds = computed(() => classifieds.value.filter(c => c.status === 'expired'));

onMounted(async () => {
  try {
    const statusFilter = canSeePrivate.value
      ? where('status', 'in', ['active', 'expired'])
      : where('status', '==', 'active');

    const liveQ = query(
      collection(db, 'classifieds'),
      where('owner_uid', '==', props.ownerUid),
      statusFilter,
      orderBy('created_at', 'desc')
    );

    const promises: Promise<void>[] = [
      getDocs(liveQ).then(snap => {
        classifieds.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classified));
      }),
    ];

    if (canSeePrivate.value) {
      const draftQ = query(
        collection(db, 'draft_classifieds'),
        where('owner_uid', '==', props.ownerUid),
        orderBy('created_at', 'desc')
      );
      promises.push(
        getDocs(draftQ).then(snap => {
          pendingClassifieds.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DraftClassified));
        })
      );
    }

    await Promise.all(promises);
  } catch (e) {
    console.error('Error fetching breeder classifieds:', e);
  } finally {
    isLoading.value = false;
  }
});

const hasAny = computed(() => classifieds.value.length > 0 || pendingClassifieds.value.length > 0);
</script>

<template>
  <div v-if="isLoading" class="text-center py-3">
    <div class="spinner-border spinner-border-sm text-muted" role="status" />
  </div>
  <template v-else-if="hasAny">
    <!-- Active classifieds -->
    <div v-if="activeClassifieds.length" class="row g-3">
      <div v-for="item in activeClassifieds" :key="item.id" class="col-md-6 col-lg-4">
        <ClassifiedCard :item="item" />
      </div>
    </div>

    <!-- Pending classifieds (owner/admin only) -->
    <div v-if="pendingClassifieds.length && canSeePrivate" :class="{ 'mt-4': activeClassifieds.length }">
      <div class="d-flex align-items-center gap-2 mb-3">
        <h6 class="text-muted text-uppercase small fw-bold mb-0 letter-spacing-1">Pending</h6>
        <hr class="flex-grow-1 my-0 opacity-10">
      </div>
      <div class="row g-3">
        <div v-for="item in pendingClassifieds" :key="item.id" class="col-md-6 col-lg-4">
          <ClassifiedCard :item="item" />
        </div>
      </div>
    </div>

    <!-- Expired classifieds (owner/admin only) -->
    <div v-if="expiredClassifieds.length && canSeePrivate" :class="{ 'mt-4': activeClassifieds.length || pendingClassifieds.length }">
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
