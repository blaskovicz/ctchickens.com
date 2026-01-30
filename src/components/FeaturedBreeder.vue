<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Breeder, DirectoryData } from '../types';

const featured = ref<Breeder | null>(null);
const showReviews = ref(false);

// --- HELPER: Get Week Number (1-52) ---
const getWeekNumber = (d: Date) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

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

onMounted(async () => {
  try {
    const response = await fetch('/directory-info.json');
    const data: DirectoryData = await response.json();
    const allBreeders = data.directory_info || [];

    // TIER 1: Explicitly marked as "Featured" (Future Paid Slots)
    const paidTier = allBreeders.filter(b => b.featured === true);

    // TIER 2: Trusted Community Members (Verified / Founding)
    const trustedTier = allBreeders.filter(b => b.verified || b.founding_breeder);

    // LOGIC: Use Paid Tier if it exists; otherwise fallback to Trusted Tier
    const pool = paidTier.length > 0 ? paidTier : trustedTier;

    if (pool.length > 0) {
      const currentWeek = getWeekNumber(new Date());
      const index = currentWeek % pool.length;
      featured.value = pool[index];
    } 

  } catch (err) {
    console.error('Error loading featured breeder:', err);
  }
});
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

          <h5 class="card-title fw-bold text-dark mb-2">
            {{ featured.name }}
          </h5>

          <div class="d-flex flex-wrap gap-2 mb-3">
            <span v-if="featured.verified" class="badge bg-success d-flex align-items-center">
              <i class="bi bi-check-circle-fill me-1"></i> Verified
            </span>
            <span v-if="featured.founding_breeder" class="badge bg-primary d-flex align-items-center">
              <i class="bi bi-award-fill me-1"></i> Founding Breeder
            </span>
          </div>

          <hr class="text-muted opacity-25 my-2">

          <div class="mb-4">
            <p class="card-text text-secondary clamped-text mb-0">
              <i class="bi bi-tag-fill me-2 text-warning"></i>
              <span class="fw-medium text-dark">Selling:</span> {{ featured.selling }}
            </p>
          </div>

          <div class="d-flex gap-2 mt-auto">
            <a v-if="featured.contact_link" :href="featured.contact_link" class="btn btn-sm btn-primary">
              <i class="bi bi-envelope-fill me-2"></i>Contact
            </a>
            <a v-if="featured.info_link" :href="featured.info_link" target="_blank" class="btn btn-sm btn-outline-dark">
              <i class="bi bi-info-circle me-2"></i>More Info
            </a>
            
            <div v-if="featured.reviews && featured.reviews.length > 0" class="ms-auto d-flex align-items-center">
               <span class="badge bg-light text-dark border me-1">
                 <i class="bi bi-hand-thumbs-up-fill text-success"></i> {{ positiveCount }}
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
                <div class="d-flex justify-content-between">
                   <strong class="small">{{ review.from }}</strong>
                   <small class="text-muted">{{ formatDate(review.date) }}</small>
                </div>
                <p class="mb-0 small text-muted mt-1">{{ review.comment }}</p>
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
          <a href="mailto:marketing@ctchickens.com" class="btn btn-sm btn-dark">
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
            Get listed to show up in our directory of thousands of local keepers. Verification is free for community members.
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