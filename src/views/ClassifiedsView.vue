<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { BButton, BSpinner, BFormInput, BFormSelect, BBadge } from 'bootstrap-vue-next';
import NewClassifiedModal from '../components/NewClassifiedModal.vue';
import type { Classified, DraftClassified, ClassifiedCategory } from '../types';
import { formatRelativeTime } from '../composables/useBreederUtils';

const store = useStore();
const router = useRouter();

const isLoading = ref(true);
const textFilter = ref('');
const locationFilter = ref('');
const categoryFilter = ref<ClassifiedCategory | ''>('');
const modalRef = ref<InstanceType<typeof NewClassifiedModal> | null>(null);

const categoryOptions = [
  { value: '', text: 'All Categories' },
  { value: 'iso', text: 'In Search Of' },
  { value: 'for_sale', text: 'For Sale' },
  { value: 'rehoming', text: 'Rehoming' },
  { value: 'hatching_eggs', text: 'Hatching Eggs' },
];

const CATEGORY_LABELS: Record<ClassifiedCategory, string> = {
  iso: 'In Search Of',
  for_sale: 'For Sale',
  rehoming: 'Rehoming',
  hatching_eggs: 'Hatching Eggs',
};

const isLoggedIn = computed(() => store.getters.isLoggedIn);
const classifieds = computed<Classified[]>(() => store.state.classifieds);
const myPendingClassifieds = computed<DraftClassified[]>(() =>
  store.state.myClassifieds.filter((c: Classified | DraftClassified) => c.status === 'pending') as DraftClassified[]
);

const filteredClassifieds = computed(() => {
  const text = textFilter.value.toLowerCase();
  const loc = locationFilter.value.toLowerCase();
  const cat = categoryFilter.value;
  return classifieds.value.filter(c => {
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
    <!-- Hero Header -->
    <div class="classifieds-header p-4 p-md-5 text-white position-relative mb-0">
      <div class="position-relative z-1">
        <div class="d-flex flex-column flex-md-row align-items-center align-items-md-end justify-content-between gap-3">
          <div class="text-center text-md-start">
            <div class="d-flex align-items-center justify-content-center justify-content-md-start gap-2 mb-2">
              <i class="bi bi-megaphone-fill fs-4 text-white opacity-75"></i>
              <span class="badge bg-white text-primary px-3 py-1 small fw-bold shadow-sm">Connecticut</span>
            </div>
            <h1 class="display-5 fw-bold text-white mb-2">Classified Ads</h1>
            <p class="text-white opacity-75 mb-0" style="max-width: 520px;">
              Poultry, livestock, hatching eggs, and farm supplies across Connecticut.
              Post what you're looking for — let the whole community see it.
            </p>
          </div>
          <BButton variant="light" class="fw-bold shadow-sm flex-shrink-0" @click="modalRef?.open()">
            <i class="bi bi-plus-lg me-1"></i> Post a Classified
          </BButton>
        </div>
      </div>
    </div>

  <div class="container py-4">

    <!-- Filters -->
    <div class="row g-2 mb-4">
      <div class="col-md-5">
        <BFormInput v-model="textFilter" placeholder="Search descriptions..." />
      </div>
      <div class="col-md-4">
        <BFormInput v-model="locationFilter" placeholder="Filter by location..." />
      </div>
      <div class="col-md-3">
        <BFormSelect v-model="categoryFilter" :options="categoryOptions" />
      </div>
    </div>

    <!-- My pending listings -->
    <div v-if="isLoggedIn && myPendingClassifieds.length > 0" class="mb-4">
      <h6 class="text-muted text-uppercase small fw-semibold mb-2">Your Pending Listings</h6>
      <div class="d-flex flex-column gap-2">
        <div
          v-for="item in myPendingClassifieds"
          :key="item.id"
          class="card border-0 shadow-sm"
          style="cursor:pointer;"
          @click="router.push(`/classified/${item.id}`)"
        >
          <div class="card-body py-2 px-3 d-flex align-items-center gap-3">
            <BBadge variant="secondary" pill>{{ CATEGORY_LABELS[item.category] }}</BBadge>
            <span class="text-dark flex-grow-1 text-truncate small">{{ item.title }}</span>
            <div class="badge bg-warning text-dark px-3 py-2 shadow-sm animate-pulse">
              <i class="bi bi-file-earmark-check me-1"></i> Pending Approval
            </div>
          </div>
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
        <div class="card h-100 border-0 shadow-sm" style="cursor:pointer;" @click="router.push(`/classified/${item.id}`)">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <BBadge variant="secondary" pill>
                {{ CATEGORY_LABELS[item.category] }}
              </BBadge>
            </div>
            <p class="card-title fw-semibold text-dark mb-1" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              {{ item.title }}
            </p>
            <p v-if="item.price" class="text-success fw-semibold small mb-1">{{ item.price }}</p>
            <p class="card-text text-muted small mb-2" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              {{ item.description }}
            </p>
            <div class="d-flex align-items-center gap-1 text-muted small">
              <i class="bi bi-geo-alt"></i>
              <span>{{ item.location }}</span>
              <span class="mx-1">·</span>
              <i class="bi bi-person"></i>
              <span>{{ item.display_name }}<span v-if="store.state.user?.uid === item.owner_uid" class="text-muted"> (you)</span></span>
            </div>
            <div class="text-muted small mt-1">
              <i class="bi bi-clock me-1"></i>Created {{ formatRelativeTime(item.created_at) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <NewClassifiedModal ref="modalRef" @submitted="store.dispatch('fetchClassifieds')" />
  </div>
  </div>
</template>

<style scoped>
.classifieds-header {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
}
.classifieds-header::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  pointer-events: none;
}
</style>
