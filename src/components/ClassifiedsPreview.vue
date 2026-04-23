<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { Classified } from '../types';
import { CATEGORY_LABELS, CATEGORY_VARIANTS } from '../types';
import { formatRelativeTime } from '../composables/useBreederUtils';
import { BBadge } from 'bootstrap-vue-next';

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
          <router-link :to="`/classified/${item.id}`" class="text-decoration-none h-100 d-block">
            <div class="card h-100 border-0 shadow-sm classified-card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <BBadge :variant="CATEGORY_VARIANTS[item.category]" pill>
                    {{ CATEGORY_LABELS[item.category] }}
                  </BBadge>
                  <span v-if="item.price" class="text-success fw-semibold small ms-auto">{{ item.price }}</span>
                </div>
                
                <h5 class="card-title fw-semibold text-dark mb-1 line-clamp-2">
                  {{ item.title }}
                </h5>
                
                <p class="card-text text-muted small mb-3 line-clamp-2">
                  <span v-if="item.description">{{ item.description }}</span>
                  <span v-else class="fst-italic opacity-50">Inquire for more info</span>
                </p>
                
                <div class="mt-auto pt-3 border-top">
                  <div class="d-flex align-items-center gap-1 text-muted small mb-1">
                    <i class="bi bi-geo-alt"></i>
                    <span class="text-truncate">{{ item.location }}</span>
                  </div>
                  <div class="d-flex justify-content-between align-items-center text-muted smaller">
                    <span class="text-truncate"><i class="bi bi-person me-1"></i>{{ item.display_name }}</span>
                    <span class="text-nowrap ms-2"><i class="bi bi-clock me-1"></i>{{ formatRelativeTime(item.created_at) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </router-link>
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
