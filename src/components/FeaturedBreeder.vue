<script setup lang="ts">
    import { ref, computed, onMounted } from 'vue';
    import type { Breeder, DirectoryData } from '../types';
    
    const featured = ref<Breeder | null>(null);
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
    
    onMounted(async () => {
      try {
        const response = await fetch('/directory-info.json');
        const data: DirectoryData = await response.json();
        featured.value = data.featured || null;
      } catch (err) {
        console.error('Error loading featured breeder:', err);
      }
    });
    </script>
    
    <template>
      <div class="row g-4 mb-5">
        <div class="col-md-6">
          <div v-if="featured" class="card h-100 border-warning shadow-sm" style="border-width: 3px;">
            <div class="card-body">
              <div class="mb-2">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h5 class="mb-1">
                      <i class="bi bi-star-fill text-warning me-1"></i>
                      Featured: {{ featured.name }}
                      <span v-if="featured.verified" class="badge bg-success ms-2">Verified</span>
                      <span v-if="featured.founding_breeder" class="badge bg-primary ms-2">
                        <i class="bi bi-star-fill text-warning me-1"></i>Founding Breeder
                      </span>
                    </h5>
                    <p class="text-muted mb-0">{{ featured.location }} | {{ featured.selling }}</p>
                  </div>
                </div>
                <div class="d-flex gap-2">
                  <a v-if="featured.contact_link" :href="featured.contact_link" class="btn btn-sm btn-primary">
                    <i class="bi bi-envelope-fill"></i> Contact
                  </a>
                  <a v-if="featured.info_link" :href="featured.info_link" target="_blank" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-info-circle-fill"></i> More Info
                  </a>
                </div>
              </div>
              
              <div v-if="featured.reviews && featured.reviews.length > 0" class="mt-3">
                <div class="d-flex align-items-center gap-2">
                  <span class="badge bg-success">
                    <i class="bi bi-hand-thumbs-up-fill"></i> {{ positiveCount }}
                  </span>
                  <span class="badge bg-danger">
                    <i class="bi bi-hand-thumbs-down-fill"></i> {{ negativeCount }}
                  </span>
                  <button 
                    @click="showReviews = !showReviews" 
                    class="btn btn-sm btn-link p-0 text-decoration-none"
                  >
                    <small>{{ showReviews ? 'Hide' : 'Show' }} Reviews</small>
                  </button>
                </div>
                
                <div v-if="showReviews" class="mt-3 reviews-container">
                  <div 
                    v-for="(review, index) in featured.reviews" 
                    :key="index"
                    class="review-item p-2 mb-2 rounded"
                    :class="review.type === 'positive' ? 'bg-success-subtle' : 'bg-danger-subtle'"
                  >
                    <div class="d-flex align-items-start">
                      <i 
                        :class="review.type === 'positive' ? 'bi-hand-thumbs-up-fill text-success' : 'bi-hand-thumbs-down-fill text-danger'"
                        class="bi me-2 mt-1"
                      ></i>
                      <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start">
                          <strong class="small">{{ review.from }}</strong>
                          <small class="text-muted">{{ formatDate(review.date) }}</small>
                        </div>
                        <p class="mb-0 small text-muted">{{ review.comment }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="card h-100 border-warning shadow-sm" style="border-width: 3px;">
            <div class="card-body d-flex justify-content-between align-items-center">
              <div>
                <h5 class="mb-1">
                  <i class="bi bi-star-fill text-warning me-1"></i>
                  Featured: None Yet!
                </h5>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-md-6">
          <div class="card h-100 border-dashed bg-light text-center py-4" style="border: 2px dashed #ccc;">
            <div class="card-body">
              <h5>Are you a local breeder?</h5>
              <p class="small text-muted">Get listed to show up in our directory of thousands of local keepers.</p>
              <a href="mailto:marketing@ctchickens.com?subject=Breeder%20Directory%20Listing%20Application" class="btn btn-sm btn-primary">
                Apply to Get Listed (marketing@ctchickens.com)
              </a>
            </div>
          </div>
        </div>
      </div>
    </template>
    
    <style scoped>
    .reviews-container {
      max-height: 300px;
      overflow-y: auto;
      overflow-x: hidden;
      border-top: 1px solid #dee2e6;
      padding-top: 0.5rem;
    }
    .bg-success-subtle { background-color: rgba(25, 135, 84, 0.1) !important; }
    .bg-danger-subtle { background-color: rgba(220, 53, 69, 0.1) !important; }
    </style>