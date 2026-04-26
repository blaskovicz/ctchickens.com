<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
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
import { useBreederUtils, formatRelativeTime } from '../composables/useBreederUtils';
import { useSupport } from '../composables/useSupport';
import { BButton } from 'bootstrap-vue-next';

const route = useRoute();
const store = useStore();
const { generateSlug, splitBreederName } = useBreederUtils();
const { contactSupport } = useSupport();

const user = computed(() => store.getters.currentUser);
const isAdmin = computed(() => store.getters.isAdmin);
const hasPendingDraft = ref(false);
const ownerProfile = ref<any>(null);

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

  // No longer blocking unverified profiles from public view.
  return found;
});

const fetchOwnerProfile = async () => {
  if (isAdmin.value && breeder.value?.ownerUid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', breeder.value.ownerUid));
      if (userDoc.exists()) {
        ownerProfile.value = userDoc.data();
      }
    } catch (e) {
      console.warn("Could not fetch owner profile:", e);
    }
  }
};

watch([() => breeder.value?.ownerUid, isAdmin], () => {
  if (isAdmin.value && breeder.value?.ownerUid) {
    fetchOwnerProfile();
  } else {
    ownerProfile.value = null;
  }
}, { immediate: true });

const isRealOwner = computed(() => {
  if (!user.value || !breeder.value) return false;
  return breeder.value.ownerUid === user.value.uid;
});

const isOwner = computed(() => {
  if (!user.value || !breeder.value) return false;
  return isAdmin.value || isRealOwner.value;
});

// True when the farm owner has no email — used to show the warning banner.
// When the real owner is viewing: check their own Auth email.
// When admin is viewing: check the owner's users-doc email (ownerProfile is already fetched).
// Only evaluates to true once ownerProfile has loaded (not null) to avoid a flash.
const ownerEmailMissing = computed(() => {
  if (isRealOwner.value) return !user.value?.email;
  if (isAdmin.value) return ownerProfile.value !== null && !ownerProfile.value?.email;
  return false;
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

</script>

<template>
  <div class="container py-3">
    <div class="d-flex justify-content-between align-items-center mb-4">
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

              <!-- Admin Owner Chip -->
              <div v-if="isAdmin" class="mt-3 d-flex justify-content-center justify-content-md-start">
                <div v-if="ownerProfile" class="admin-owner-chip d-flex align-items-center gap-2 px-2 py-1 rounded-pill bg-white bg-opacity-10 border border-white border-opacity-25 shadow-sm">
                  <img :src="ownerProfile.photoURL || '/hen.png'" class="rounded-circle bg-white" width="24" height="24">
                  <span class="small fw-bold">{{ ownerProfile.displayName }}</span>
                  <span class="small opacity-75">| seen {{ formatRelativeTime(ownerProfile.lastLogin) }}</span>
                </div>
                <div v-else class="admin-owner-chip d-flex align-items-center gap-2 px-2 py-1 rounded-pill bg-white bg-opacity-10 border border-white border-opacity-25 shadow-sm opacity-75">
                  <i class="bi bi-person-x"></i>
                  <span class="small">Unclaimed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card-body p-4 bg-white">
        
        <!-- No Email Warning Banner (Visible only to owner with no email on their account) -->
        <div v-if="(isAdmin || isRealOwner) && ownerEmailMissing" class="alert alert-warning border-0 shadow-sm d-flex align-items-start gap-3 mb-4 py-3">
          <i class="bi bi-envelope-exclamation-fill fs-2 text-warning mt-1"></i>
          <div>
            <h6 class="alert-heading fw-bold mb-2 text-warning">No email address on your account</h6>
            <p class="mb-0 small text-dark">
              Your Facebook account has no email address. We won't be able to notify you when your profile is approved or updated.
              Add an email to your Facebook account and log in again to fix this.
            </p>
          </div>
        </div>

        <!-- Verified Member Welcome Banner (Visible only to verified owner) -->
        <div v-if="(isAdmin || isRealOwner) && isVerified(breeder.verified)" class="alert alert-success border-0 shadow-sm d-flex align-items-start gap-3 mb-4 py-3">
          <i class="bi bi-heart-fill fs-2 text-success mt-1"></i>
          <div>
            <h6 class="alert-heading fw-bold mb-2 text-success">Thank you for being a Verified Member!</h6>
            <p class="mb-2 small text-dark">
              Your support helps maintain and grow our community. This is your public profile page where you can showcase your farm to the world!
            </p>
            <hr class="my-2 opacity-25">
            <div class="d-flex flex-wrap align-items-center gap-2 gap-md-3">
              <router-link :to="`/directory/${generateSlug(breeder.name)}/edit`" class="fw-bold text-success text-decoration-none small">
                <i class="bi bi-pencil-square me-1"></i> Update your profile
              </router-link>
              <span class="text-muted small d-none d-md-inline">|</span>
              <router-link to="/inbox" class="fw-bold text-success text-decoration-none small">
                <i class="bi bi-chat-right-text me-1"></i> Check inbox for leads
              </router-link>
              <span class="text-muted small d-none d-md-inline">|</span>
              <a href="#" @click.prevent="contactSupport" class="fw-bold text-success text-decoration-none small">
                <i class="bi bi-headset me-1"></i> Contact support
              </a>
            </div>
          </div>
        </div>

        <!-- Verification Perks Banner (Visible only to unverified owner) -->
        <div v-if="(isAdmin || isRealOwner) && !isVerified(breeder.verified)" class="alert alert-primary border-0 shadow-sm d-flex align-items-start gap-3 mb-4 py-3">
          <i class="bi bi-patch-check-fill fs-2 text-primary mt-1"></i>
          <div>
            <h6 class="alert-heading fw-bold mb-2 text-primary">Unlock Your Professional Profile</h6>
            <p class="mb-2 small text-dark">
              Your profile is currently visible to everyone, but hasn't reached its full potential.
              Once verified, you'll unlock:
            </p>
            <div class="d-flex flex-column gap-2 small text-dark">
              <div class="d-flex align-items-center">
                <i class="bi bi-unlock-fill me-2 text-primary"></i>
                Public Photo Gallery & Trust Badges
              </div>
              <div class="d-flex align-items-center">
                <i class="bi bi-unlock-fill me-2 text-primary"></i>
                Direct Website & Email links
              </div>
              <div class="d-flex align-items-center">
                <i class="bi bi-unlock-fill me-2 text-primary"></i>
                Featured Listing status
              </div>
              <div class="d-flex align-items-center">
                <i class="bi bi-unlock-fill me-2 text-primary"></i>
                Up to 10 Classified Ads &amp; more renewals per listing
              </div>
            </div>
            <hr class="my-2 opacity-25">
            <div class="d-flex flex-wrap align-items-center gap-2 gap-md-3">
              <router-link :to="`/directory/${generateSlug(breeder.name)}/edit`" class="fw-bold text-primary text-decoration-none small">
                <i class="bi bi-pencil-square me-1"></i> Complete your profile
              </router-link>
              <span class="text-muted small d-none d-md-inline">|</span>
              <router-link to="/inbox" class="fw-bold text-primary text-decoration-none small">
                <i class="bi bi-chat-right-text me-1"></i> Check inbox for leads
              </router-link>
              <span class="text-muted small d-none d-md-inline">|</span>
              <a href="#" @click.prevent="contactSupport" class="fw-bold text-primary text-decoration-none small">
                <i class="bi bi-headset me-1"></i> Contact support to get verified
              </a>
            </div>
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
                <p v-if="breeder.selling" class="fs-6 mb-0 text-dark">{{ breeder.selling }}</p>
                <p v-else class="fs-6 mb-0 text-muted fst-italic">Inquire for more info</p>
              </div>
            </div>

            <div class="d-flex align-right flex-wrap gap-2 mt-3">
              <!-- Always show Message Breeder -->
              <ContactButton 
                :link="breeder.contact_link" 
                :breeder="breeder" 
                :show-label-on-mobile="true" 
                :force-secure-only="false"
              />
              
              <!-- Only show external contact/info if verified -->
              <template v-if="isVerified(breeder.verified)">
                <MoreInfoButton 
                  :link="breeder.info_link" 
                  :name="breeder.name" 
                  :verified="breeder.verified" 
                  :show-label-on-mobile="true"
                />
              </template>
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