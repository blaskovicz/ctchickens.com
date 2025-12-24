const { createApp } = Vue;

// Featured Breeder Component
const FeaturedBreeder = {
  template: `
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
                  </h5>
                  <p class="text-muted mb-0">{{ featured.location }} | {{ featured.selling }}</p>
                </div>
              </div>
              <div class="d-flex gap-2">
                <a :href="featured.contact_link" class="btn btn-sm btn-primary">
                  <i class="bi bi-envelope-fill"></i> Contact
                </a>
                <a :href="featured.info_link" target="_blank" class="btn btn-sm btn-outline-primary">
                  <i class="bi bi-info-circle-fill"></i> More Info
                </a>
              </div>
            </div>
            
            <!-- Reviews Section -->
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
              
              <!-- Reviews Dropdown -->
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
            <a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#109;&#97;&#114;&#107;&#101;&#116;&#105;&#110;&#103;&#64;&#99;&#116;&#99;&#104;&#105;&#99;&#107;&#101;&#110;&#115;&#46;&#99;&#111;&#109;?subject=Breeder%20Directory%20Listing%20Application" class="btn btn-sm btn-primary">
              Apply to Get Listed (&#109;&#97;&#114;&#107;&#101;&#116;&#105;&#110;&#103;&#64;&#99;&#116;&#99;&#104;&#105;&#99;&#107;&#101;&#110;&#115;&#46;&#99;&#111;&#109;)
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  
  data() {
    return {
      featured: null,
      showReviews: false
    };
  },
  
  computed: {
    positiveCount() {
      if (!this.featured?.reviews) return 0;
      return this.featured.reviews.filter(r => r.type === 'positive').length;
    },
    
    negativeCount() {
      if (!this.featured?.reviews) return 0;
      return this.featured.reviews.filter(r => r.type === 'negative').length;
    }
  },
  
  methods: {
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    },
    
    async loadFeatured() {
      try {
        const response = await fetch('directory-info.json');
        if (!response.ok) {
          throw new Error('Failed to load featured breeder');
        }
        const data = await response.json();
        this.featured = data.featured || null;
      } catch (err) {
        console.error('Error loading featured breeder:', err);
      }
    }
  },
  
  mounted() {
    this.loadFeatured();
  }
};

// Breeder Table Component
const BreederTable = {
  template: `
    <div class="row mt-5">
      <div class="col-12">
        <h3 class="mb-3 text-center">All Listed Breeders & Suppliers</h3>
        
        <!-- Search/Filter Box -->
        <div class="row mb-3">
          <div class="col-md-6 mx-auto">
            <div class="input-group">
              <span class="input-group-text bg-light">
                <i class="bi bi-search"></i>
              </span>
              <input 
                v-model="filter"
                type="text" 
                class="form-control" 
                placeholder="Search by name, location, or breeds..."
                aria-label="Search breeders">
              <button class="btn btn-outline-secondary" type="button" @click="clearFilter">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
            <small v-if="filter" class="text-muted ms-2">
              Showing {{ filteredItems.length }} of {{ breeders.length }} breeders
            </small>
          </div>
        </div>
        
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-muted mt-2">Loading breeders...</p>
        </div>
        
        <!-- Error State -->
        <div v-else-if="error" class="alert alert-danger" role="alert">
          <i class="bi bi-exclamation-triangle me-2"></i>
          {{ error }}
        </div>
        
        <!-- Table -->
        <div v-else class="table-responsive">
          <table class="table table-striped table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th v-for="field in fields" 
                    :key="field.key"
                    @click="field.sortable ? sortTable(field.key) : null"
                    :style="field.sortable ? 'cursor: pointer;' : ''">
                  {{ field.label }}
                  <i v-if="field.sortable && sortBy === field.key" 
                     :class="sortDesc ? 'bi bi-chevron-down' : 'bi bi-chevron-up'"
                     class="ms-1"></i>
                  <i v-else-if="field.sortable" class="bi bi-chevron-expand ms-1 text-muted" style="font-size: 0.75rem;"></i>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="breeder in sortedAndFilteredItems" :key="breeder.name">
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <strong>{{ breeder.name }}</strong>
                    <span v-if="breeder.verified" class="badge bg-success" style="font-size: 0.65rem;">Verified</span>
                    <span v-if="breeder.reviews && breeder.reviews.length > 0" class="text-nowrap">
                      <span class="badge bg-success-subtle text-success border border-success" style="font-size: 0.7rem;">
                        <i class="bi bi-hand-thumbs-up-fill"></i> {{ getPositiveCount(breeder) }}
                      </span>
                      <span class="badge bg-danger-subtle text-danger border border-danger ms-1" style="font-size: 0.7rem;">
                        <i class="bi bi-hand-thumbs-down-fill"></i> {{ getNegativeCount(breeder) }}
                      </span>
                    </span>
                  </div>
                </td>
                <td>{{ breeder.location }}</td>
                <td>{{ breeder.selling }}</td>
                <td><small class="text-muted">{{ formatDate(breeder.updated) }}</small></td>
                <td class="text-end">
                  <a :href="breeder.contact_link" class="btn btn-sm btn-primary">
                    <i class="bi bi-envelope-fill"></i> Contact
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
          
          <!-- No Results -->
          <div v-if="filteredItems.length === 0" class="text-center py-4 text-muted">
            <i class="bi bi-inbox fs-1 d-block mb-2"></i>
            No breeders match your search.
          </div>
        </div>
        
        <p class="text-muted small text-center mt-3">
          <i class="bi bi-info-circle me-1"></i>
          Listings are provided by community members. Please contact breeders/suppliers directly to verify availability.
        </p>
        <p class="text-muted small text-center">
          To update ratings, leave comments, or get listed, please email us at <a href="mailto:marketing@ctchickens.com">marketing@ctchickens.com</a>.
        </p>
      </div>
    </div>
  `,
  
  data() {
    return {
      breeders: [],
      filter: '',
      loading: true,
      error: null,
      sortBy: 'updated',
      sortDesc: true,
      fields: [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'location', label: 'Location', sortable: true },
        { key: 'selling', label: 'Breeds/Products', sortable: true },
        { key: 'updated', label: 'Last Updated', sortable: true },
        { key: 'actions', label: '', sortable: false }
      ]
    };
  },
  
  computed: {
    filteredItems() {
      if (!this.filter) {
        return this.breeders;
      }
      
      const searchTerm = this.filter.toLowerCase();
      return this.breeders.filter(breeder => {
        return (
          breeder.name.toLowerCase().includes(searchTerm) ||
          breeder.location.toLowerCase().includes(searchTerm) ||
          breeder.selling.toLowerCase().includes(searchTerm)
        );
      });
    },
    
    sortedAndFilteredItems() {
      const items = [...this.filteredItems];
      
      if (!this.sortBy) return items;
      
      return items.sort((a, b) => {
        let aVal = this.sortBy === 'updated' ? new Date(a[this.sortBy]) : a[this.sortBy];
        let bVal = this.sortBy === 'updated' ? new Date(b[this.sortBy]) : b[this.sortBy];
        
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        
        if (aVal < bVal) return this.sortDesc ? 1 : -1;
        if (aVal > bVal) return this.sortDesc ? -1 : 1;
        return 0;
      });
    }
  },
  
  methods: {
    clearFilter() {
      this.filter = '';
    },
    
    sortTable(key) {
      if (this.sortBy === key) {
        this.sortDesc = !this.sortDesc;
      } else {
        this.sortBy = key;
        this.sortDesc = false;
      }
    },
    
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    },
    
    getPositiveCount(breeder) {
      if (!breeder.reviews) return 0;
      return breeder.reviews.filter(r => r.type === 'positive').length;
    },
    
    getNegativeCount(breeder) {
      if (!breeder.reviews) return 0;
      return breeder.reviews.filter(r => r.type === 'negative').length;
    },
    
    async loadBreeders() {
      try {
        const response = await fetch('directory-info.json');
        if (!response.ok) {
          throw new Error('Failed to load breeders');
        }
        const data = await response.json();
        this.breeders = data.directory_info || [];
        this.loading = false;
      } catch (err) {
        console.error('Error loading breeders:', err);
        this.error = 'Error loading breeders list. Please refresh the page.';
        this.loading = false;
      }
    }
  },
  
  mounted() {
    this.loadBreeders();
  }
};

// Main App
const app = createApp({
  components: {
    'featured-breeder': FeaturedBreeder,
    'breeder-table': BreederTable
  }
});

// Use Bootstrap Vue Next
if (window.BootstrapVueNext) {
  app.use(window.BootstrapVueNext);
}

// Mount the app
app.mount('#app');

