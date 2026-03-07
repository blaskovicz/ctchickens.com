<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import type { Breeder } from '../types';
import BreederGallery from './BreederGallery.vue';
import VerifiedBadge from './VerifiedBadge.vue';
import FoundingBreederBadge from './FoundingBreederBadge.vue';
import ContactButton from './ContactButton.vue';
import MoreInfoButton from './MoreInfoButton.vue';
import VerifiedMemberLink from './VerifiedMemberLink.vue';
import { useBreederUtils } from '../composables/useBreederUtils';

const store = useStore();
const { splitBreederName } = useBreederUtils();
const featured = computed(() => store.getters.featuredBreeder as Breeder | null);
const showReviews = ref(false);

const positiveCount = computed(() => 
  featured.value?.reviews?.filter(r => r.type === 'positive').length ?? 0
);

const negativeCount = computed(() => 
  featured.value?.reviews?.filter(r => r.type === 'negative').length ?? 0
);

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric' 
  });
};

</script>

<template>
  <div class="row g-4 mb-5">
    
    <div class="col-md-6">
      <div v-if="featured" class="card h-100 border-warning shadow-sm position-relative overflow-hidden" style="border-width: 3px;">
        
        <div class="card-body bg-light bg-opacity-10 d-flex flex-column">
          
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge bg-warning text-dark d-flex align-items-center px-2 py-1">
              <i class="bi bi-star-fill me-1"></i> FEATURED PARTNER
            </span>
            <span class="text-muted small">
              <i class="bi bi-geo-alt-fill me-1"></i>{{ featured.location }}
            </span>
          </div>

          <h5 class="card-title fw-bold text-dark mb-1">
            <VerifiedMemberLink 
              :name="featured.name" 
              :display-name="splitBreederName(featured.name).main"
              :verified="featured.verified" 
              icon-style="font-size: 1.5rem; line-height: 1;"
            />
          </h5>
          <div v-if="splitBreederName(featured.name).person" class="text-muted fst-italic font-serif mb-2" style="font-size: 0.95rem; font-weight: normal;">
            by {{ splitBreederName(featured.name).person }}
          </div>
          <div v-else class="mb-2"></div>

          <div class="d-flex flex-wrap gap-1 mb-3">
            <VerifiedBadge :verified="featured.verified" />
            <FoundingBreederBadge :count="featured.founding_breeder" />
          </div>

          <hr class="text-muted opacity-25 my-2">

          <div class="mb-4">
            <p class="card-text text-secondary clamped-text mb-0">
              <i class="bi bi-tag-fill me-2 text-warning"></i>
              <span class="fw-medium text-dark">Selling:</span> {{ featured.selling }}
            </p>
          </div>

          <div class="mb-4">
            <BreederGallery 
              :logo="featured.logo" 
              :images="featured.images" 
            />
          </div>

          <div class="d-flex gap-2 mt-auto align-items-center flex-wrap">
            <ContactButton :link="featured.contact_link" :show-label-on-mobile="true" />
            <MoreInfoButton 
              :link="featured.info_link" 
              :name="featured.name" 
              :verified="featured.verified" 
              :show-label-on-mobile="true"
            />
            
            <div v-if="featured.reviews && featured.reviews.length > 0" class="ms-auto d-flex align-items-center gap-1">
                <span 
                  v-if="positiveCount > 0" 
                  title="positive reviews"
                  class="badge bg-light text-secondary border">
                  <i class="bi bi-hand-thumbs-up-fill"></i> {{ positiveCount }}
                </span>
                <span 
                  v-if="negativeCount > 0" 
                  title="negative reviews"
                  class="badge bg-light text-secondary border">
                  <i class="bi bi-hand-thumbs-down-fill"></i> {{ negativeCount }}
                </span>
            </div>
          </div>

          <div v-if="featured.reviews && featured.reviews.length > 0" class="mt-3 pt-2 border-top">
            <button @click="showReviews = !showReviews" class="btn btn-sm btn-link text-decoration-none px-0 w-100 text-start">
               <i :class="showReviews ? 'bi-chevron-up' : 'bi-chevron-down'" class="bi me-1"></i>
               <span v-if="!showReviews">Read Reviews</span>
               <span v-else>Hide Reviews</span>
            </button>
            
            <div v-if="showReviews" class="mt-2 reviews-container">
              <div 
                v-for="(review, index) in featured.reviews" 
                :key="index"
                class="review-item p-2 mb-2 rounded bg-light border"
              >
                <div class="d-flex justify-content-between align-items-start">
                    <div class="d-flex align-items-center">
                      <i 
                        :class="review.type === 'positive' ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-down-fill'"
                        class="bi me-2 fs-6 text-secondary"
                        :title="review.type"
                      ></i>
                      <strong class="small">{{ review.from }}</strong>
                    </div>
                    <small class="text-muted">{{ formatDate(review.date) }}</small>
                </div>
                <p class="mb-0 small text-muted mt-1 ms-4">{{ review.comment }}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      <div v-else class="card h-100 border-warning shadow-sm" style="border-width: 3px; background-color: #fff3cd;">
        <div class="card-body d-flex flex-column justify-content-center align-items-center text-center">
          <h5 class="mb-2 fw-bold">
            <i class="bi bi-star-fill text-warning me-1"></i>
            This Spot Available!
          </h5>
          <p class="small text-muted mb-3">
            Want to feature your farm or coop services here?
          </p>
          <a target="_blank" href="mailto:marketing@ctchickens.com?subject=Inquiry%20from%20ctchickens.com" class="btn btn-sm btn-dark">
            Become a Partner
          </a>
        </div>
      </div>
    </div>
    
    <div class="col-md-6">
      <div class="card h-100 border-dashed bg-light text-center py-3 d-flex flex-column justify-content-center" style="border: 2px dashed #ccc;">
        <div class="card-body">
          <div class="mb-3">
             <i class="bi bi-shop fs-2 text-muted opacity-50"></i>
          </div>
          <h5 class="fw-bold">Are you a local breeder?</h5>
          <p class="small text-muted px-4">
            Get listed to show up in our directory of thousands of local keepers.
            Get verified to build trust with our community.
          </p>
          <a href="mailto:marketing@ctchickens.com?subject=Breeder%20Directory%20Listing%20Application" class="btn btn-primary mt-2">
            Apply to Get Listed
          </a>
          <div class="mt-3">
            <small class="text-muted fst-italic">marketing@ctchickens.com</small>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.clamped-text {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
}

.reviews-container {
  max-height: 200px;
  overflow-y: auto;
}

/* Make sure the dashed border looks nice */
.border-dashed {
  border-style: dashed !important;
}
</style>