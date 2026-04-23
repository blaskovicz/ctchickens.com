<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import ClassifiedCard from './ClassifiedCard.vue';
import type { Classified } from '../types';

const classifieds = ref<Classified[]>([]);
const isLoading = ref(true);

onMounted(async () => {
  try {
    const q = query(
      collection(db, 'classifieds'),
      where('status', '==', 'active'),
      orderBy('created_at', 'desc'),
      limit(3)
    );
    const snap = await getDocs(q);
    classifieds.value = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classified));
  } catch (e) {
    console.error('Error fetching recent classifieds:', e);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <section v-if="classifieds.length > 0" class="py-5 bg-white">
    <div class="container">
      <div class="row align-items-end mb-4">
        <div class="col-lg-9 text-center text-lg-start">
          <h2 class="display-5 fw-bold text-dark">Recent Classified Ads</h2>
          <p class="lead mb-0 text-muted">
            Latest posts from the community — birds, eggs, supplies, and more.
          </p>
        </div>
        <div class="col-lg-3 text-center text-lg-end mt-4 mt-lg-0">
          <router-link to="/classified" class="btn btn-primary px-4 shadow-sm">
            View All Classifieds<i class="bi bi-arrow-right ms-2"></i>
          </router-link>
        </div>
      </div>

      <div class="row g-4">
        <div v-for="item in classifieds" :key="item.id" class="col-md-4">
          <ClassifiedCard :item="item" />
        </div>
      </div>
    </div>
  </section>
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
  height: 160px;
  overflow: hidden;
  background-color: #f8f9fa;
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

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.smaller {
  font-size: 0.75rem;
}
</style>
