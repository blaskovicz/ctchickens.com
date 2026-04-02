<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
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

// Since the store fetches asynchronously, we need to ensure it's fetched.
onMounted(async () => {
  if (store.getters.allBreeders.length === 0) {
    await store.dispatch('fetchDirectory');
  }

  // Check for pending draft if user has access
  const slug = route.params.slug as string;
  if (user.value) {
    try {
      const draftRef = doc(db, 'draft_profiles', slug);
      const draftSnap = await getDoc(draftRef);
      if (draftSnap.exists()) {
        hasPendingDraft.value = true;
      }
    } catch (err) {
      console.warn("Draft check failed:", err);
    }
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
    
    <div v-else-if="breeder" class="card shadow-lg border-0">
      <div class="card-body p-4 p-md-5">
        
        <!-- Private Profile Notice -->
        <div v-if="!isVerified(breeder.verified)" class="alert alert-warning border-warning shadow-sm d-flex align-items-center gap-3 mb-5">
          <i class="bi bi-shield-lock-fill fs-2"></i>
          <div>
            <h5 class="alert-heading fw-bold mb-1">Private Profile</h5>
            <p class="mb-0">This profile is not yet public. Only verified members have a public permalink. You are seeing this because you are the owner or an admin. <strong>Please contact an admin to get verified.</strong></p>
          </div>
        </div>

        <div class="row g-4">
          <!-- Main Info -->
          <div :class="(breeder.reviews && breeder.reviews.length > 0) ? 'col-lg-8' : 'col-12'">
            <div class="d-flex flex-column flex-md-row align-items-center align-items-md-start gap-4 mb-4">
              <img v-if="breeder.logo" :src="breeder.logo" class="rounded border shadow-sm profile-logo mb-3 mb-md-0" :alt="breeder.name + ' Logo'" referrerpolicy="no-referrer" />
              <div class="flex-grow-1 text-center text-md-start">
                <div class="d-flex flex-wrap justify-content-center justify-content-md-start align-items-center gap-2 mb-3">
                  <span class="badge bg-light text-secondary border uc-first">
                    {{ breeder.category }}
                  </span>
                  <span class="text-muted small">
                    <i class="bi bi-geo-alt-fill me-1"></i>{{ breeder.location }}
                  </span>
                </div>
                
                <h1 class="display-5 fw-bold text-dark mb-1">
                  <VerifiedMemberLink 
                    :name="breeder.name"
                    :display-name="splitBreederName(breeder.name).main" 
                    :verified="breeder.verified" 
                    icon-style="font-size: 2rem; line-height: 1;"
                    link-class="text-decoration-none text-dark d-flex align-items-start justify-content-center justify-content-md-start"
                  />
                </h1>
                <h4 v-if="splitBreederName(breeder.name).person" class="text-muted fst-italic mb-3 font-serif">by {{ splitBreederName(breeder.name).person }}</h4>
                <div v-else class="mb-3"></div>
                
                <div class="d-flex flex-wrap justify-content-center justify-content-md-start gap-1">
                  <VerifiedBadge :verified="breeder.verified" />
                  <FoundingBreederBadge :count="breeder.founding_breeder" />
                </div>
              </div>
            </div>

            <div class="mb-4">
              <h5 class="fw-bold mb-3"><i class="bi bi-tag-fill me-2 text-muted"></i>Selling</h5>
              <p class="fs-5">{{ breeder.selling }}</p>
            </div>

            <div class="d-flex align-right flex-wrap gap-2 mt-4">
              <ContactButton :link="breeder.contact_link" :show-label-on-mobile="true" />
              
              <!-- Messenger Button -->
              <BButton 
                v-if="breeder.facebookUid" 
                :href="`https://m.me/${breeder.facebookUid}`" 
                target="_blank" 
                variant="outline-primary" 
                size="sm"
                class="d-inline-flex align-items-center gap-2 px-3 shadow-sm text-nowrap"
              >
                <i class="bi bi-messenger"></i>
                <span>Chat on Messenger</span>
              </BButton>

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
            <div class="card bg-light border-0 h-100">
              <div class="card-body">
                <h5 class="fw-bold mb-3">Community Reviews</h5>
                <div class="d-flex gap-3 mb-4">
                  <div v-if="getPositiveCount(breeder) > 0" class="text-success d-flex align-items-center">
                    <i class="bi bi-hand-thumbs-up-fill fs-2 me-2"></i>
                    <span class="fs-4 fw-bold">{{ getPositiveCount(breeder) }}</span>
                  </div>
                  <div v-if="getNegativeCount(breeder) > 0" class="text-danger d-flex align-items-center">
                    <i class="bi bi-hand-thumbs-down-fill fs-2 me-2"></i>
                    <span class="fs-4 fw-bold">{{ getNegativeCount(breeder) }}</span>
                  </div>
                </div>
                
                <div class="reviews-list">
                  <div v-for="(review, index) in breeder.reviews" :key="index" class="mb-3 pb-3 border-bottom border-secondary-subtle last-border-0">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                      <div class="d-flex align-items-center">
                        <i :class="review.type === 'positive' ? 'bi-hand-thumbs-up-fill text-success' : 'bi-hand-thumbs-down-fill text-danger'" class="bi me-2"></i>
                        <strong>{{ review.from }}</strong>
                      </div>
                      <small class="text-muted">{{ formatDate(review.date) }}</small>
                    </div>
                    <p class="mb-0 small text-muted ms-4">{{ review.comment }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Gallery -->
        <div v-if="(breeder.images && breeder.images.length > 0) || breeder.logo" class="mt-5 pt-4 border-top">
          <h4 class="fw-bold mb-4">Gallery</h4>
          <BreederGallery :logo="breeder.logo" :images="breeder.images" />
        </div>
        
        <div class="text-end mt-4 pt-3 border-top">
          <small class="text-muted">Last updated: {{ formatDate(breeder.updated) }}</small>
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

.profile-logo {
  width: 120px;
  height: 120px;
  object-fit: contain;
  background-color: white;
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .profile-logo {
    width: 150px;
    height: 150px;
  }
}
</style>