<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import type { Breeder } from '../types';
import VerifiedBadge from './VerifiedBadge.vue';
import FoundingBreederBadge from './FoundingBreederBadge.vue';
import ContactButton from './ContactButton.vue';
import ViewProfileButton from './ViewProfileButton.vue';
import VerifiedMemberLink from './VerifiedMemberLink.vue';
import { useBreederUtils } from '../composables/useBreederUtils';

const store = useStore();
const router = useRouter();
const { splitBreederName, generateSlug } = useBreederUtils();

const breeders = computed(() => store.getters.allBreeders as Breeder[]);
const loading = computed(() => breeders.value.length === 0 && !store.state.authReady);

const previewBreeders = computed(() => {
  return [...breeders.value]
    .filter(b => b.verified)
    .sort((a, b) => {
      // 1. Founding members first
      if (a.founding_breeder && !b.founding_breeder) return -1;
      if (!a.founding_breeder && b.founding_breeder) return 1;
      
      // 2. If both are founding members, sort by number ascending (1, 2, 3...)
      if (a.founding_breeder && b.founding_breeder) {
        return a.founding_breeder - b.founding_breeder;
      }
      
      // 3. Then by updated date (descending)
      return new Date(b.updated).getTime() - new Date(a.updated).getTime();
    });
    //.slice(0, 5); // TODO: revisit in the future if we need pagination
});
</script>

<template>
  <div class="breeder-preview mt-4">
    <div v-if="loading" class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
    
    <div v-else class="table-responsive">
      <table class="table table-hover align-middle">
        <thead class="table-light thead-row">
          <tr>
            <th>Name</th>
            <th class="d-none d-lg-table-cell">Location</th>
            <th class="d-none d-lg-table-cell">Selling</th>
            <th class="text-end actions-col"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="breeder in previewBreeders" :key="breeder.id">
            <tr class="main-row" @click="router.push({ name: 'breeder-profile', params: { slug: generateSlug(breeder.name) } })">
              <td class="name-cell">
                <div class="d-flex align-items-center gap-3">
                  <img
                    :src="breeder.logo || '/hen.png'"
                    class="rounded bg-white border shadow-sm"
                    :class="{ 'grayscale': !breeder.logo }"
                    :alt="breeder.name"
                    style="width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; padding: 2px;"
                    referrerpolicy="no-referrer"
                  />
                  <div class="d-flex flex-column gap-1">
                    <div>
                      <strong>
                        <VerifiedMemberLink
                          :name="breeder.name"
                          :display-name="splitBreederName(breeder.name).main"
                          :verified="breeder.verified"
                        />
                      </strong>
                      <div v-if="splitBreederName(breeder.name).person" class="text-muted fst-italic" style="font-size: 0.8rem;">
                        by {{ splitBreederName(breeder.name).person }}
                      </div>
                    </div>
                    <div class="d-flex align-items-center gap-1">
                      <VerifiedBadge :verified="breeder.verified" />
                      <FoundingBreederBadge :count="breeder.founding_breeder" />
                    </div>
                  </div>
                  <i class="bi bi-chevron-right ms-auto text-muted d-lg-none"></i>
                </div>
              </td>
            <td class="d-none d-lg-table-cell text-muted">{{ breeder.location }}</td>
            <td class="d-none d-lg-table-cell text-muted small">
              <template v-if="breeder.selling">
                {{ breeder.selling }}
              </template>
              <span v-else class="fst-italic opacity-50">Inquire for more info</span>
            </td>
            <td class="text-end actions-col" @click.stop>
              <div class="d-flex justify-content-end gap-2">
                <ContactButton :link="breeder.contact_link" :breeder="breeder" :force-secure-only="true" />
                <ViewProfileButton :breeder-name="breeder.name" size="sm" />
              </div>
            </td>
          </tr>
          <tr class="d-lg-none border-top-0">
            <td colspan="4" class="pt-1 pb-3 ps-3 pe-3">
              <div class="small text-muted mb-1">
                <i class="bi bi-geo-alt-fill me-1 text-secondary opacity-75"></i>{{ breeder.location }}
              </div>
              <div class="small text-muted text-truncate-mobile mb-3">
                <i class="bi bi-tag-fill me-1 text-secondary opacity-75"></i>
                <span v-if="breeder.selling">{{ breeder.selling }}</span>
                <span v-else class="fst-italic opacity-50">Inquire for more info</span>
              </div>
              <div class="d-flex gap-2">
                <ContactButton :link="breeder.contact_link" :breeder="breeder" :force-secure-only="true" />
                <ViewProfileButton :breeder-name="breeder.name" size="sm" />
              </div>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.breeder-preview {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.table {
  margin-bottom: 0;
}
.grayscale {
  filter: grayscale(100%);
  opacity: 0.7;
}
.main-row { cursor: pointer; }
@media (max-width: 991.98px) {
  .thead-row { display: none !important; }
  .actions-col { display: none !important; }
  .d-lg-none td { border-bottom: 2px solid rgba(30, 58, 138, 0.50) !important; }
}
</style>
