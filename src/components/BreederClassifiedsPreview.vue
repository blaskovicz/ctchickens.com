<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import ClassifiedCard from './ClassifiedCard.vue';
import type { Classified } from '../types';

const props = defineProps<{ ownerUid: string; isOwner?: boolean }>();

const classifieds = ref<Classified[]>([]);
const isLoading = ref(true);

onMounted(async () => {
  try {
    const q = query(
      collection(db, 'classifieds'),
      where('owner_uid', '==', props.ownerUid),
      where('status', '==', 'active'),
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
    <div class="row g-3">
      <div v-for="item in classifieds" :key="item.id" class="col-md-6 col-lg-4">
        <ClassifiedCard :item="item" />
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
