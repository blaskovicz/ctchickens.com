<script setup lang="ts">
    import { ref, computed } from 'vue';
    import { useStore } from 'vuex';
    import type { Breeder } from '../types';
    import BreederGallery from './BreederGallery.vue';
    import VerifiedBadge from './VerifiedBadge.vue';
    import FoundingBreederBadge from './FoundingBreederBadge.vue';
    import ContactButton from './ContactButton.vue';
    import ViewProfileButton from './ViewProfileButton.vue';
    import VerifiedMemberLink from './VerifiedMemberLink.vue';
    import { useBreederUtils } from '../composables/useBreederUtils';
    import { useSupport } from '../composables/useSupport';

    const store = useStore();
    const { splitBreederName } = useBreederUtils();
    const { contactSupport } = useSupport();
    const filter = ref('');
    const selectedCategory = ref('');
    const showVerifiedOnly = ref(false);
    const breeders = computed(() => store.getters.allBreeders as Breeder[]);
    const loading = computed(() => breeders.value.length === 0);    
    const sortBy = ref<keyof Breeder>('name');
    const sortDesc = ref(false);
    
    const fields = [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'category', label: 'Category', sortable: false },
      { key: 'location', label: 'Location', sortable: true },
      { key: 'selling', label: 'Breeds/Products', sortable: true },
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

    const handleContactSupport = () => contactSupport();

    // Automatically finds all unique categories from the loaded data
    const uniqueCategories = computed(() => {
      const cats = new Set(breeders.value.map(b => b.category));
      // Capitalize first letter for display if needed, or keep raw
      return Array.from(cats).sort(); 
    });
    
    const filteredItems = computed(() => {
      // Start with all breeders
      let items = breeders.value;

      // 1. Filter by Category
      if (selectedCategory.value && selectedCategory.value !== '') {
        items = items.filter(b => b.category === selectedCategory.value);
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
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
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
                  <select v-model="selectedCategory" class="form-select w-100 uc-first">
                    <option value="">All Categories</option>
                    <option class="uc-first" v-for="cat in uniqueCategories" :key="cat" :value="cat">
                      {{ cat }}
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
                        :class="['category', 'location'].includes(field.key) ? 'd-none d-md-table-cell' : ''">
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
                        <div class="mb-1 mb-md-0">
                          <strong>
                            <VerifiedMemberLink 
                              :name="breeder.name" 
                              :display-name="splitBreederName(breeder.name).main"
                              :verified="breeder.verified" 
                            />
                          </strong>
                          <div v-if="splitBreederName(breeder.name).person" class="text-muted fst-italic font-serif" style="font-size: 0.85rem; font-weight: normal; margin-top: 0.15rem;">
                            by {{ splitBreederName(breeder.name).person }}
                          </div>
                        </div>
                        <div class="d-flex align-items-center gap-1">
                          <VerifiedBadge :verified="breeder.verified" />
                          <FoundingBreederBadge :count="breeder.founding_breeder" />
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
                    <td class="d-none d-md-table-cell">
                      <span class="badge bg-light text-secondary border uc-first">
                        {{ breeder.category }}
                      </span>
                    </td>
                    <td class="d-none d-md-table-cell">{{ breeder.location }}</td>
                    <td class="text-md-end align-middle">
                      <div class="d-flex flex-row justify-content-end gap-2">
                        <!-- Directory ONLY shows Message & Profile -->
                        <ContactButton :link="breeder.contact_link" :breeder="breeder" :force-secure-only="true" />
                        <ViewProfileButton :breeder-name="breeder.name" />
                      </div>
                    </td>
                  </tr>
                  <tr class="breeds-row">
                    <td colspan="100" class="bg-light p-0">
                      <div class="p-3 border-bottom d-flex flex-column h-100">
                        
                        <div class="mb-2 text-muted flex-grow-1">
                          <i class="bi bi-tag-fill me-1 text-secondary"></i>
                          <strong>Selling:</strong> 
                          <span v-if="breeder.selling">&nbsp;{{ breeder.selling }}</span>
                          <span v-else class="text-muted fst-italic">&nbsp;Inquire for more info</span>
                        </div>

                        <div 
                          v-if="breeder.verified && ((breeder.images && breeder.images.length > 0) || breeder.logo)"
                          style="max-width: 85vw;"
                          class="mt-3">
                          <div style="display: grid; grid-template-columns: minmax(0, 1fr);">
                            <p class="text-xs fw-bold text-muted text-uppercase mb-2 small">Gallery</p>
                            
                            <BreederGallery 
                              :logo="breeder.logo" 
                              :images="breeder.images" 
                            />
                          </div>
                        </div>

                        <div class="d-flex justify-content-between align-items-end mt-3 border-top pt-2">
                          <div class="d-md-none d-flex flex-wrap gap-2 align-items-center">
                            <span class="badge bg-light text-secondary border uc-first">
                              {{ breeder.category }}
                            </span>
                            <span class="text-muted small">
                              <i class="bi bi-geo-alt-fill me-1"></i>{{ breeder.location }}
                            </span>
                          </div>
                          <div class="text-end flex-grow-1">
                            <small class="text-muted">Last updated: {{ formatDate(breeder.updated) }}</small>
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
            If you need help, please <a href="#" @click.prevent="handleContactSupport">contact support</a>.
            To get listed, <router-link to="/get-listed">click here to start your listing</router-link>.
          </p>
          </div>
          </div>
          </template>

          <style scoped>    .uc-first {
      text-transform: capitalize;
    }
    .breeds-row td {
      font-size: 0.9rem;
      border-top: 1px solid #e9ecef;

      border-bottom: 16px solid transparent; /* Adds the "empty space" */
      background-clip: padding-box;          /* Stops hover colors from painting the space */
      position: relative;                    /* Keeps z-index stacking clean */
    }
</style>
