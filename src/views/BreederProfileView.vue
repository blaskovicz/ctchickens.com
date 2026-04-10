<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Breeder } from '../types';
import BreederGallery from '../components/BreederGallery.vue';
import VerifiedBadge from '../components/VerifiedBadge.vue';
import FoundingBreederBadge from '../components/FoundingBreederBadge.vue';
import ContactButton from '../components/ContactButton.vue';
import MoreInfoButton from '../components/MoreInfoButton.vue';
import VerifiedMemberLink from '../components/VerifiedMemberLink.vue';
import { useBreederUtils } from '../composables/useBreederUtils';
import { BButton } from 'bootstrap-vue-next';

const route = useRoute();
const router = useRouter();
const store = useStore();
const { generateSlug, splitBreederName } = useBreederUtils();

const user = computed(() => store.getters.currentUser);
const isAdmin = computed(() => store.getters.isAdmin);
const hasPendingDraft = ref(false);

const isVerified = (val: any) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined';
  }
  return !!val;
};

const breeder = computed(() => {
  const slug = route.params.slug as string;
  const allBreeders = store.getters.allBreeders as Breeder[];
  const found = allBreeders.find(b => generateSlug(b.name) === slug);
  
  if (!found) return null;

  const verified = isVerified(found.verified);
  const admin = isAdmin.value;
  // FIX: Ensure both IDs exist before comparing to avoid undefined === undefined
  const owner = !!user.value?.uid && !!found.ownerUid && found.ownerUid === user.value?.uid;

  console.log(`Access Check [${slug}]:`, {
    businessName: found.name,
    isVerified: verified,
    rawVerified: found.verified,
    isAdmin: admin,
    isOwner: owner,
    currentUid: user.value?.uid,
    ownerUid: found.ownerUid
  });

  // PUBLIC SAFETY: Only allow viewing if verified OR if the current user is an admin/owner
  if (!verified && !admin && !owner) {
    console.warn(`Access Denied: Non-verified profile [${slug}] hidden from public.`);
    return null;
  }
  
  return found;
});

const isOwner = computed(() => {
  if (!user.value || !breeder.value) return false;
  return isAdmin.value || breeder.value.ownerUid === user.value.uid;
});

// Check for pending draft in Firestore
const checkDraftStatus = async () => {
  hasPendingDraft.value = false;
  const slug = route.params.slug as string;
  
  if (user.value && slug) {
    try {
      const draftRef = doc(db, 'draft_profiles', slug);
      const draftSnap = await getDoc(draftRef);
      hasPendingDraft.value = draftSnap.exists();
    } catch (err) {
      console.warn("Draft check failed:", err);
    }
  }
};

// Re-check draft status whenever the slug or user session changes
watch([() => route.params.slug, user], () => {
  checkDraftStatus();
}, { immediate: true });

// Since the store fetches asynchronously, we need to ensure it's fetched.
onMounted(async () => {
  if (store.getters.allBreeders.length === 0) {
    await store.dispatch('fetchDirectory');
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
    <div class="d-flex justify-content-between align-items-center mb-4">
      <button class="btn btn-outline-secondary" @click="goBack">
        <i class="bi bi-arrow-left me-2"></i>Back to Directory
      </button>
      
      <div class="d-flex align-items-center gap-3">
        <!-- Draft Badge -->
        <div v-if="isOwner && hasPendingDraft" class="badge bg-warning text-dark px-3 py-2 shadow-sm animate-pulse">
          <i class="bi bi-file-earmark-check me-1"></i> Draft Pending Approval
        </div>

        <!-- Show Edit button only to Owner or Admin -->
        <BButton 
          v-if="isOwner && breeder" 
          :to="`/directory/${generateSlug(breeder.name)}/edit`" 
          variant="primary" 
          class="d-flex align-items-center gap-2 shadow-sm"
        >
          <i class="bi bi-pencil-square"></i>
          {{ isAdmin ? 'Moderate Profile' : 'Edit Your Profile' }}
        </BButton>
      </div>
    </div>
    
    <div v-if="!breeder && store.getters.allBreeders.length > 0" class="text-center py-5">
      <h2 class="display-6 fw-bold">Member Not Found</h2>
      <p class="lead">The verified member you're looking for doesn't exist or is no longer listed.</p>
    </div>
    
    <div v-else-if="breeder" class="card shadow-web border-0 overflow-hidden profile-card">
      <!-- HERO HEADER -->
      <div class="profile-header p-4 text-white position-relative">
        <div class="profile-header-content position-relative z-1">
          <div class="d-flex flex-column flex-md-row align-items-center align-items-md-start gap-3 gap-md-4">
            <img 
              :src="breeder.logo || '/hen.png'" 
              class="rounded border border-3 border-white border-opacity-25 shadow-sm profile-logo mb-2 mb-md-0 bg-white" 
              :class="{ 'grayscale': !breeder.logo }"
              :alt="breeder.name + ' Logo'" 
              referrerpolicy="no-referrer" 
            />
            <div class="flex-grow-1 text-center text-md-start">
              <div class="d-flex flex-wrap justify-content-center justify-content-md-start align-items-center gap-2 mb-2">
                <span class="badge bg-white text-primary uc-first px-3 py-1 small fw-bold shadow-sm border-0">
                  {{ breeder.category }}
                </span>
                <span class="text-white-50 small">
                  <i class="bi bi-geo-alt-fill me-1"></i>{{ breeder.location }}
                </span>
              </div>
              
              <h1 class="display-5 fw-bold text-white mb-1">
                <VerifiedMemberLink 
                  :name="breeder.name"
                  :display-name="splitBreederName(breeder.name).main" 
                  :verified="breeder.verified" 
                  icon-style="font-size: 2rem; line-height: 1;"
                  link-class="text-decoration-none text-white d-flex align-items-start justify-content-center justify-content-md-start"
                  icon-class="bi bi-link-45deg ms-1 text-white-50"
                />
              </h1>
              <h4 v-if="splitBreederName(breeder.name).person" class="text-white-50 fst-italic mb-3 font-serif fs-5">by {{ splitBreederName(breeder.name).person }}</h4>
              
              <div class="d-flex flex-wrap justify-content-center justify-content-md-start gap-2">
                <VerifiedBadge :verified="breeder.verified" />
                <FoundingBreederBadge :count="breeder.founding_breeder" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card-body p-4 bg-white">
        
        <!-- Private Profile Notice -->
        <div v-if="!isVerified(breeder.verified)" class="alert alert-warning border-0 shadow-sm d-flex align-items-center gap-3 mb-4 py-2">
          <i class="bi bi-shield-lock-fill fs-3"></i>
          <div>
            <h6 class="alert-heading fw-bold mb-0">Private Profile</h6>
            <p class="mb-0 small">This profile is not yet public. Only verified members have a public permalink. <strong>Please contact an admin to get verified.</strong></p>
          </div>
        </div>

        <div class="row g-4">
          <!-- Main Info -->
          <div :class="(breeder.reviews && breeder.reviews.length > 0) ? 'col-lg-8' : 'col-12'">
            <div class="mb-4">
              <h5 class="fw-bold mb-2 text-dark d-flex align-items-center">
                <span class="icon-circle me-2 bg-light text-muted"><i class="bi bi-tag-fill"></i></span>
                Selling
              </h5>
              <div class="p-3 bg-light rounded-4 shadow-sm border selling-box">
                <p class="fs-6 mb-0 text-dark">{{ breeder.selling }}</p>
              </div>
            </div>

            <div class="d-flex align-right flex-wrap gap-2 mt-3">
              <ContactButton :link="breeder.contact_link" :breeder="breeder" :show-label-on-mobile="true" />
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
            <div class="card bg-light border-0 rounded-4 h-100 shadow-sm">
              <div class="card-body p-3">
                <h6 class="fw-bold mb-3">Community Reviews</h6>
                <div class="d-flex gap-3 mb-3">
                  <div v-if="getPositiveCount(breeder) > 0" class="text-success d-flex align-items-center">
                    <i class="bi bi-hand-thumbs-up-fill fs-3 me-2"></i>
                    <span class="fs-5 fw-bold">{{ getPositiveCount(breeder) }}</span>
                  </div>
                  <div v-if="getNegativeCount(breeder) > 0" class="text-danger d-flex align-items-center">
                    <i class="bi bi-hand-thumbs-down-fill fs-3 me-2"></i>
                    <span class="fs-5 fw-bold">{{ getNegativeCount(breeder) }}</span>
                  </div>
                </div>
                
                <div class="reviews-list" style="max-height: 300px;">
                  <div v-for="(review, index) in breeder.reviews" :key="index" class="mb-2 pb-2 border-bottom border-secondary-subtle last-border-0">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                      <div class="d-flex align-items-center">
                        <i :class="review.type === 'positive' ? 'bi-hand-thumbs-up-fill text-success' : 'bi-hand-thumbs-down-fill text-danger'" class="bi me-2 small"></i>
                        <strong class="small">{{ review.from }}</strong>
                      </div>
                      <small class="text-muted smaller">{{ formatDate(review.date) }}</small>
                    </div>
                    <p class="mb-0 smaller text-muted ms-4">{{ review.comment }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Gallery -->
        <div v-if="(breeder.images && breeder.images.length > 0) || breeder.logo" class="mt-4 pt-3 border-top">
          <h5 class="fw-bold mb-3">Gallery</h5>
          <BreederGallery :logo="breeder.logo" :images="breeder.images" />
        </div>
        
        <div class="text-end mt-3 pt-2 border-top">
          <small class="text-muted smaller">Last updated: {{ formatDate(breeder.updated) }}</small>
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

.profile-card {
  border-radius: 1.25rem;
}

.shadow-web {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
}

.profile-header {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
}

.profile-header::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  pointer-events: none;
}

.icon-circle {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.9rem;
}

.rounded-4 {
  border-radius: 1rem !important;
}

.selling-box {
  min-height: 80px;
}

.profile-logo {
  width: 120px;
  height: 120px;
  object-fit: contain;
  background-color: white;
  flex-shrink: 0;
}

.grayscale {
  filter: grayscale(100%);
  opacity: 0.7;
}

@media (min-width: 768px) {
  .profile-logo {
    width: 150px;
    height: 150px;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .7; }
}
</style>