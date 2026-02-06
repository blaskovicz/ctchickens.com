<script setup lang="ts">
    import { ref, computed } from 'vue';
    import { useStore } from 'vuex';
    import type { Breeder } from '../types';
    import BreederGallery from './BreederGallery.vue';

    const store = useStore();
    const filter = ref('');
    const selectedCategory = ref('');
    const showVerifiedOnly = ref(false);
    const breeders = computed(() => store.getters.allBreeders as Breeder[]);
    const loading = computed(() => breeders.value.length === 0);    
    const sortBy = ref<keyof Breeder>('updated');
    const sortDesc = ref(true);
    
    const fields = [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'location', label: 'Location', sortable: true },
      { key: 'selling', label: 'Breeds/Products', sortable: true },
      { key: 'updated', label: 'Last Updated', sortable: true },
      { key: 'actions', label: '', sortable: false }
    ] as const;
    
    // Sort verified items to the top
    const verifiedSort = (a: Breeder, b: Breeder) => {
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;
      return 0;
    };
    
    const getPositiveCount = (breeder: Breeder) => 
      breeder.reviews?.filter(r => r.type === 'positive').length ?? 0;
    
    const getNegativeCount = (breeder: Breeder) => 
      breeder.reviews?.filter(r => r.type === 'negative').length ?? 0;
    
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric' 
      });
    };

    // Automatically finds all unique categories from the loaded data
    const uniqueCategories = computed(() => {
      const cats = new Set(breeders.value.map(b => b.category || 'Breeder'));
      // Capitalize first letter for display if needed, or keep raw
      return Array.from(cats).sort(); 
    });
    
    const filteredItems = computed(() => {
      // Start with all breeders
      let items = breeders.value;

      // 1. Filter by Category
      if (selectedCategory.value && selectedCategory.value !== '') {
        items = items.filter(b => (b.category || 'Breeder') === selectedCategory.value);
      }

      // 2. Filter by Verified Status
      if (showVerifiedOnly.value) {
        items = items.filter(b => b.verified);
      }

      // 3. Filter by Text Search (Existing Logic)
      if (filter.value) {
        const searchTerm = filter.value.toLowerCase();
        items = items.filter(breeder => 
          breeder.name.toLowerCase().includes(searchTerm) ||
          breeder.location.toLowerCase().includes(searchTerm) ||
          breeder.selling.toLowerCase().includes(searchTerm)
        );
      }

      return items;
    });
    
    const sortedAndFilteredItems = computed(() => {
      const items = [...filteredItems.value];
      
      // 1. Sort by selected column
      items.sort((a, b) => {
        let aVal = a[sortBy.value as keyof Breeder];
        let bVal = b[sortBy.value as keyof Breeder];
        
        // Handle date sorting specifically
        if (sortBy.value === 'updated') {
            aVal = new Date(aVal as string).getTime();
            bVal = new Date(bVal as string).getTime();
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
    
        if (aVal! < bVal!) return sortDesc.value ? 1 : -1;
        if (aVal! > bVal!) return sortDesc.value ? -1 : 1;
        return 0;
      });
    
      // 2. Always float Verified to top
      return items.sort(verifiedSort);
    });
    
    const sortTable = (key: string) => {
      const typedKey = key as keyof Breeder;
      if (sortBy.value === typedKey) {
        sortDesc.value = !sortDesc.value;
      } else {
        sortBy.value = typedKey;
        sortDesc.value = false;
      }
    };
    
    const clearFilter = () => {
      filter.value = '';
    };

    </script>
    
    <template>
      <div class="row mt-5">
        <div class="col-12">
          <h3 class="mb-3 text-center">All Listed Breeders & Suppliers</h3>
          
          <div class="row mb-3">
            <div class="col-12 col-md-10 mx-auto">
              
              <div class="row g-2 align-items-center">
                
                <div class="col-12 col-md">
                  <div class="input-group">
                    <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
                    <input 
                      v-model="filter"
                      type="text" 
                      class="form-control" 
                      placeholder="Search..." 
                      aria-label="Search breeders">
                    <button v-if="filter" class="btn btn-outline-secondary" type="button" @click="clearFilter">
                      <i class="bi bi-x-lg"></i>
                    </button>
                  </div>
                </div>

                <div class="col-6 col-md-auto">
                  <select v-model="selectedCategory" class="form-select w-100">
                    <option value="">All Categories</option>
                    <option v-for="cat in uniqueCategories" :key="cat" :value="cat">
                      {{ cat.charAt(0).toUpperCase() + cat.slice(1) }}
                    </option>
                  </select>
                </div>

                <div class="col-6 col-md-auto">
                  <div class="form-check form-switch border rounded bg-white d-flex align-items-center justify-content-center px-2" style="height: 38px;">
                    <input 
                      v-model="showVerifiedOnly" 
                      class="form-check-input my-0 ms-1" 
                      type="checkbox" 
                      id="verifiedSwitch"
                      style="cursor: pointer;"
                    >
                    <label class="form-check-label small ms-2 text-nowrap" for="verifiedSwitch" style="cursor: pointer;">
                      Verified Only
                    </label>
                  </div>
                </div>

              </div>

              <div class="text-center mt-2 small text-muted">
                <span v-if="loading">Loading...</span>
                <span v-else>
                  Showing {{ filteredItems.length }} result{{ filteredItems.length !== 1 ? 's' : '' }}
                </span>
              </div>

            </div>
          </div>
          
          <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mt-2">Loading...</p>
          </div>
          
          <div v-else class="table-responsive">
            <table class="table table-striped table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <template v-for="field in fields" :key="field.key">
                    <th v-if="field.key !== 'selling'"
                        @click="field.sortable ? sortTable(field.key) : null"
                        :style="field.sortable ? 'cursor: pointer;' : ''"
                        :class="{
                          'd-none d-md-table-cell': field.key === 'updated'
                        }">
                      {{ field.label }}
                      <i v-if="field.sortable && sortBy === field.key" 
                         :class="sortDesc ? 'bi bi-chevron-down' : 'bi bi-chevron-up'"
                         class="ms-1"></i>
                      <i v-else-if="field.sortable" class="bi bi-chevron-expand ms-1 text-muted" style="font-size: 0.75rem;"></i>
                    </th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <template v-for="breeder in sortedAndFilteredItems" :key="breeder.name">
                  <tr>
                    <td>
                      <div class="d-flex align-items-center gap-2 flex-wrap">
                        <div>
                          <strong v-if="breeder.verified && breeder.info_link">
                            <a :href="breeder.info_link" target="_blank" class="">
                              {{ breeder.name }}
                            </a>
                          </strong>
                          <strong v-else>
                            {{ breeder.name }}
                          </strong>
                        </div>
                        <div>
                          <span v-if="breeder.verified" class="badge bg-success me-1">
                            <i class="bi bi-check-circle-fill me-1"></i>Verified
                          </span>
                          <span v-if="breeder.founding_breeder" class="badge bg-primary me-1">
                            <i class="bi bi-award-fill me-1"></i>Founding Breeder
                          </span>
                          <span v-if="breeder.reviews && breeder.reviews.length > 0" class="text-nowrap">
                            <span 
                              v-if="getPositiveCount(breeder) > 0"
                              title="positive reviews"
                              class="badge bg-light text-secondary border me-1" 
                              style="font-size: 0.7rem;">
                              <i class="bi bi-hand-thumbs-up-fill"></i> {{ getPositiveCount(breeder) }}
                            </span>
                            <span 
                              v-if="getNegativeCount(breeder) > 0" 
                              title="negative reviews"
                              class="badge bg-light text-secondary border" 
                              style="font-size: 0.7rem;">
                              <i class="bi bi-hand-thumbs-down-fill"></i> {{ getNegativeCount(breeder) }}
                            </span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{{ breeder.location }}</td>
                    <td class="d-none d-md-table-cell">
                      <small class="text-muted">{{ formatDate(breeder.updated) }}</small>
                    </td>
                    <td class="text-end">
                      <div class="d-flex flex-column flex-md-row justify-content-end gap-2 align-items-end">
                        <a 
                          v-if="breeder.contact_link" 
                          :href="breeder.contact_link" 
                          class="btn btn-sm btn-primary text-nowrap"
                        >
                          <i class="bi bi-envelope-fill"></i> <span class="d-none d-lg-inline">Contact</span>
                        </a>

                        <a 
                          v-if="breeder.info_link" 
                          :href="breeder.info_link" 
                          target="_blank"
                          class="btn btn-sm btn-outline-dark text-nowrap"
                        >
                          <i class="bi bi-info-circle"></i> <span class="d-none d-lg-inline">More Info</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                  <tr class="breeds-row">
                    <td colspan="100" class="bg-light p-0">
                      <div class="p-3 border-bottom">
                        
                        <div class="mb-2 text-muted">
                          <i class="bi bi-tag-fill me-1 text-secondary"></i>
                          <strong>Selling:</strong> {{ breeder.selling }}
                        </div>

                        <div 
                          v-if="breeder.verified && ((breeder.images && breeder.images.length > 0) || breeder.logo)"
                          style="max-width: 85vw;"
                          class="mt-3">
                          <div class="mt-3" style="display: grid; grid-template-columns: minmax(0, 1fr);">
                            <p class="text-xs fw-bold text-muted text-uppercase mb-2 small">Gallery</p>
                            
                            <BreederGallery 
                              :logo="breeder.logo" 
                              :images="breeder.images" 
                            />
                          </div>
                        </div>

                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
            
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
    </template>

<style scoped>
    .breeds-row td {
      font-size: 0.9rem;
      border-top: 1px solid #e9ecef;

      border-bottom: 16px solid transparent; /* Adds the "empty space" */
      background-clip: padding-box;          /* Stops hover colors from painting the space */
      position: relative;                    /* Keeps z-index stacking clean */
    }
</style>