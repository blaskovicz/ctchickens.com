<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import type { Breeder } from '../types';
import BreederGallery from '../components/BreederGallery.vue';
import VerifiedBadge from '../components/VerifiedBadge.vue';
import FoundingBreederBadge from '../components/FoundingBreederBadge.vue';
import ContactButton from '../components/ContactButton.vue';
import MoreInfoButton from '../components/MoreInfoButton.vue';
import VerifiedMemberLink from '../components/VerifiedMemberLink.vue';
import { useBreederUtils } from '../composables/useBreederUtils';

const route = useRoute();
const router = useRouter();
const store = useStore();
const { generateSlug } = useBreederUtils();

const breeder = computed(() => {
  const slug = route.params.slug as string;
  const allBreeders = store.getters.allBreeders as Breeder[];
  return allBreeders.find(b => b.verified && generateSlug(b.name) === slug);
});

const formattedName = computed(() => {
  if (!breeder.value) return { main: '', person: null };
  const name = breeder.value.name;
  const match = name.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (match) {
    return { main: match[1], person: match[2] };
  }
  return { main: name, person: null };
});

// Since the store fetches asynchronously, we need to ensure it's fetched.
onMounted(() => {
  if (store.getters.allBreeders.length === 0) {
    store.dispatch('fetchDirectory');
  }
});

const getPositiveCount = (b: Breeder) => b.reviews?.filter(r => r.type === 'positive').length ?? 0;
const getNegativeCount = (b: Breeder) => b.reviews?.filter(r => r.type === 'negative').length ?? 0;

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric' 
  });
};

const goBack = () => {
  router.push('/directory');
};
</script>

<template>
  <div class="container py-3">
    <button class="btn btn-outline-secondary mb-4" @click="goBack">
      <i class="bi bi-arrow-left me-2"></i>Back to Directory
    </button>
    
    <div v-if="!breeder && store.getters.allBreeders.length > 0" class="text-center py-5">
      <h2 class="display-6 fw-bold">Member Not Found</h2>
      <p class="lead">The verified member you're looking for doesn't exist or is no longer listed.</p>
    </div>
    
    <div v-else-if="breeder" class="card shadow-lg border-0">
      <div class="card-body p-4 p-md-5">
        <div class="row g-4">
          <!-- Main Info -->
          <div :class="(breeder.reviews && breeder.reviews.length > 0) ? 'col-lg-8' : 'col-12'">
            <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
              <span class="badge bg-light text-secondary border uc-first">
                {{ breeder.category }}
              </span>
              <span class="text-muted small">
                <i class="bi bi-geo-alt-fill me-1"></i>{{ breeder.location }}
              </span>
            </div>
            
            <h2 class="display-5 fw-bold text-dark mb-1">
              <VerifiedMemberLink 
                :name="formattedName.main" 
                :verified="breeder.verified" 
                icon-style="font-size: 2rem; line-height: 1;"
              />
            </h2>
            <h4 v-if="formattedName.person" class="text-muted fst-italic mb-3 font-serif">by {{ formattedName.person }}</h4>
            <div v-else class="mb-3"></div>
            
            <div class="d-flex flex-wrap gap-1 mb-4">
              <VerifiedBadge :verified="breeder.verified" />
              <FoundingBreederBadge :count="breeder.founding_breeder" />
            </div>

            <div class="mb-4">
              <h5 class="fw-bold mb-3"><i class="bi bi-tag-fill me-2 text-primary"></i>Selling</h5>
              <p class="fs-5">{{ breeder.selling }}</p>
            </div>

            <div class="d-flex align-right flex-wrap gap-2 mt-4">
              <ContactButton :link="breeder.contact_link" :show-label-on-mobile="true" />
              <MoreInfoButton 
                :link="breeder.info_link" 
                :name="breeder.name" 
                :verified="breeder.verified" 
                :show-label-on-mobile="true"
              />
            </div>
          </div>
          
          <!-- Reviews Summary -->
          <div class="col-lg-4" v-if="breeder.reviews && breeder.reviews.length > 0">
            <div class="card bg-light border-0 h-100">
              <div class="card-body">
                <h5 class="fw-bold mb-3">Community Reviews</h5>
                <div class="d-flex gap-3 mb-4">
                  <div v-if="getPositiveCount(breeder) > 0" class="text-success d-flex align-items-center">
                    <i class="bi bi-hand-thumbs-up-fill fs-2 me-2"></i>
                    <span class="fs-4 fw-bold">{{ getPositiveCount(breeder) }}</span>
                  </div>
                  <div v-if="getNegativeCount(breeder) > 0" class="text-danger d-flex align-items-center">
                    <i class="bi bi-hand-thumbs-down-fill fs-2 me-2"></i>
                    <span class="fs-4 fw-bold">{{ getNegativeCount(breeder) }}</span>
                  </div>
                </div>
                
                <div class="reviews-list">
                  <div v-for="(review, index) in breeder.reviews" :key="index" class="mb-3 pb-3 border-bottom border-secondary-subtle last-border-0">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                      <div class="d-flex align-items-center">
                        <i :class="review.type === 'positive' ? 'bi-hand-thumbs-up-fill text-success' : 'bi-hand-thumbs-down-fill text-danger'" class="bi me-2"></i>
                        <strong>{{ review.from }}</strong>
                      </div>
                      <small class="text-muted">{{ formatDate(review.date) }}</small>
                    </div>
                    <p class="mb-0 small text-muted ms-4">{{ review.comment }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Gallery -->
        <div v-if="(breeder.images && breeder.images.length > 0) || breeder.logo" class="mt-5 pt-4 border-top">
          <h4 class="fw-bold mb-4">Gallery</h4>
          <BreederGallery :logo="breeder.logo" :images="breeder.images" />
        </div>
        
        <div class="text-end mt-4 pt-3 border-top">
          <small class="text-muted">Last updated: {{ formatDate(breeder.updated) }}</small>
        </div>
      </div>
    </div>
    
    <div v-else class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uc-first { text-transform: capitalize; }
.last-border-0:last-child { border-bottom: none !important; margin-bottom: 0 !important; padding-bottom: 0 !important; }
.reviews-list { max-height: 400px; overflow-y: auto; padding-right: 10px; }
.reviews-list::-webkit-scrollbar { width: 6px; }
.reviews-list::-webkit-scrollbar-track { background: #f1f1f1; }
.reviews-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
.font-serif { font-family: Georgia, 'Times New Roman', Times, serif; }
</style>