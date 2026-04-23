<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { BButton, BSpinner, BFormInput, BFormSelect } from 'bootstrap-vue-next';
import NewClassifiedModal from '../components/NewClassifiedModal.vue';
import PageHero from '../components/PageHero.vue';
import ClassifiedCard from '../components/ClassifiedCard.vue';
import type { Classified, DraftClassified, ClassifiedCategory } from '../types';
import { CATEGORY_LABELS } from '../types';

const store = useStore();
const router = useRouter();

const isLoading = ref(true);
const textFilter = ref('');
const locationFilter = ref('');
const categoryFilter = ref<ClassifiedCategory | ''>('');
const showMyOnly = ref(false);
const modalRef = ref<InstanceType<typeof NewClassifiedModal> | null>(null);

const categoryOptions = [
  { value: '', text: 'All Categories' },
  ...Object.entries(CATEGORY_LABELS).map(([value, text]) => ({ value, text }))
];

const isLoggedIn = computed(() => store.getters.isLoggedIn);
const user = computed(() => store.state.user);
const classifieds = computed<Classified[]>(() => store.state.classifieds);
const myPendingClassifieds = computed<DraftClassified[]>(() =>
  store.state.myClassifieds.filter((c: Classified | DraftClassified) => c.status === 'pending') as DraftClassified[]
);

const filteredClassifieds = computed(() => {
  const text = textFilter.value.toLowerCase();
  const loc = locationFilter.value.toLowerCase();
  const cat = categoryFilter.value;
  return classifieds.value.filter(c => {
    if (showMyOnly.value && c.owner_uid !== user.value?.uid) return false;
    if (cat && c.category !== cat) return false;
    if (loc && !c.location.toLowerCase().includes(loc)) return false;
    if (text && !c.title.toLowerCase().includes(text) && !c.description.toLowerCase().includes(text) && !c.location.toLowerCase().includes(text)) return false;
    return true;
  });
});

onMounted(async () => {
  const promises: Promise<any>[] = [store.dispatch('fetchClassifieds')];
  if (store.getters.isLoggedIn) {
    promises.push(store.dispatch('fetchMyClassifieds', store.state.user.uid));
  }
  await Promise.all(promises);
  isLoading.value = false;
});
</script>

<template>
  <div>
    <PageHero
      title="Classified Ads"
      description="Poultry, livestock, hatching eggs, and farm supplies across Connecticut. Post what you're looking for — let the whole community see it."
      icon="bi-megaphone-fill"
    >
      <template #actions>
        <BButton variant="light" class="fw-bold shadow-sm px-4" @click="modalRef?.open()">
          <i class="bi bi-plus-lg me-1"></i> Post a Classified
        </BButton>
      </template>
    </PageHero>

    <div class="container py-4">

      <!-- Filters -->
      <div class="row g-2 mb-4 align-items-center">
        <div :class="isLoggedIn ? 'col-md-4' : 'col-md-5'">
          <BFormInput v-model="textFilter" placeholder="Search descriptions..." />
        </div>
        <div :class="isLoggedIn ? 'col-md-3' : 'col-md-4'">
          <BFormInput v-model="locationFilter" placeholder="Filter by location..." />
        </div>
        <div class="col-md-3">
          <BFormSelect v-model="categoryFilter" :options="categoryOptions" />
        </div>
        <div v-if="isLoggedIn" class="col-md-2">
          <div class="form-check form-switch border rounded bg-white d-flex align-items-center justify-content-center px-2" style="height: 38px;">
            <input 
              v-model="showMyOnly" 
              class="form-check-input my-0 ms-1" 
              type="checkbox" 
              id="myOnlySwitch"
              style="cursor: pointer;"
            >
            <label class="form-check-label small ms-2 text-nowrap" for="myOnlySwitch" style="cursor: pointer;">
              My Listings
            </label>
          </div>
        </div>
      </div>

      <!-- My pending listings -->
      <div v-if="isLoggedIn && myPendingClassifieds.length > 0" class="mb-5">
        <div class="d-flex align-items-center gap-2 mb-3">
          <h6 class="text-muted text-uppercase small fw-bold mb-0 letter-spacing-1">Your Pending Listings</h6>
          <hr class="flex-grow-1 my-0 opacity-10">
        </div>
        <div class="row g-3">
          <div v-for="item in myPendingClassifieds" :key="item.id" class="col-md-6 col-lg-4">
            <ClassifiedCard :item="item" show-owner-label />
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="text-center py-5">
        <BSpinner variant="primary" />
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredClassifieds.length === 0" class="text-center py-5 text-muted">
        <i class="bi bi-search fs-1 d-block mb-3"></i>
        <p class="mb-0">No active classifieds found{{ textFilter || locationFilter || categoryFilter ? ' matching your filters' : '' }}.</p>
        <BButton variant="outline-primary" class="mt-3" @click="modalRef?.open()">Be the first to post</BButton>
      </div>

      <!-- Listings grid -->
      <div v-else class="row g-3">
        <div v-for="item in filteredClassifieds" :key="item.id" class="col-md-6 col-lg-4">
          <ClassifiedCard :item="item" show-owner-label />
        </div>
      </div>

      <NewClassifiedModal ref="modalRef" @submitted="store.dispatch('fetchClassifieds')" />
    </div>
  </div>
</template>

<style scoped>
.letter-spacing-1 {
  letter-spacing: 0.05rem;
}
</style>
