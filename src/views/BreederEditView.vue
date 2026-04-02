<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { db } from '../firebase';
import BreederGallery from '../components/BreederGallery.vue';
import { 
  doc, getDoc, setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { 
  useToast, 
  BAlert, BBadge, BButton, BCard, BFormCheckbox, BFormInput, BFormTextarea, BSpinner, BModal, BFormSelect
} from 'bootstrap-vue-next';

const route = useRoute();
const router = useRouter();
const store = useStore();
const { create } = useToast();

const slug = route.params.slug as string;
const isAdmin = computed(() => store.getters.isAdmin);
const user = computed(() => store.getters.currentUser);

const isLoading = ref(true);
const isSaving = ref(false);
const isDiscarding = ref(false);
const showDiscardModal = ref(false);
const error = ref<string | null>(null);
const liveData = ref<any | null>(null); // Store the actual live document
const initialData = ref<any | null>(null); // Store the initial form data for comparison
const initialAdminFields = ref<any | null>(null); // Store the initial admin fields for comparison
const hasPendingDraft = ref(false);
const isLocked = ref(true); // Admin-only: Lock fields during review

// Local state for the tag input box
const tagInput = ref('');

const toggleLock = () => {
  isLocked.value = !isLocked.value;
};

// Form Data (The Editor State)
const formData = ref({
  profile: { businessName: '', memberType: '', town: '', contactEmail: '', website: '' },
  offerings: { description: '', searchTags: [] as string[] },
  media: { logoUrl: '', galleryUrls: [] as string[] },
  account: { ownerUid: '', status: 'draft', facebookUid: null as string | null }
});

// Admin-only fields
const adminFields = ref({
  isVerified: false,
  foundingMember: null as number | null
});

const breederTypeOptions = [
  { value: 'breeder', text: 'Breeder' },
  { value: 'hobbyist', text: 'Hobbyist' },
  { value: 'farm', text: 'Farm' },
  { value: 'hatchery', text: 'Hatchery' },
  { value: 'supplier', text: 'Supplier' },
  { value: 'rescue', text: 'Rescue' },
  { value: 'other', text: 'Other' }
];

const hasChanges = computed(() => {
  if (!initialData.value) return false;
  const dataChanged = JSON.stringify(formData.value) !== JSON.stringify(initialData.value);
  const adminChanged = isAdmin.value ? JSON.stringify(adminFields.value) !== JSON.stringify(initialAdminFields.value) : false;
  return dataChanged || adminChanged;
});

const handleDiscard = async () => {
  if (!liveData.value) return;
  isDiscarding.value = true;
  try {
    // 1. Delete from Firestore
    const draftRef = doc(db, 'draft_profiles', slug);
    await deleteDoc(draftRef);

    // 2. Revert Editor to Live State
    formData.value = JSON.parse(JSON.stringify(liveData.value));
    hasPendingDraft.value = false;
    showDiscardModal.value = false;
    
    // Also reset initial state so hasChanges is correct
    initialData.value = JSON.parse(JSON.stringify(liveData.value));
    if (isAdmin.value) {
      adminFields.value = {
        isVerified: liveData.value.account?.isVerified || false,
        foundingMember: liveData.value.account?.foundingMember || null
      };
      initialAdminFields.value = JSON.parse(JSON.stringify(adminFields.value));
    }

    create?.({ body: "Pending draft discarded. Editor reset to live version.", variant: 'info' });
  } catch (e: any) {
    create?.({ body: "Discard error: " + e.message, variant: 'danger' });
  } finally {
    isDiscarding.value = false;
  }
};

onMounted(async () => {
  try {
    // 1. Fetch the LIVE data
    const docRef = doc(db, 'directory_members', slug);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Normalize data to ensure objects and arrays exist
      if (!data.offerings) data.offerings = {};
      if (!data.offerings.searchTags) data.offerings.searchTags = [];
      if (!data.media) data.media = {};
      if (!data.media.galleryUrls) data.media.galleryUrls = [];
      
      liveData.value = data;
      
      // Default: Initialize editor with live data (Deep clone ensures no reference sharing)
      formData.value = JSON.parse(JSON.stringify(liveData.value));
      formData.value.profile.memberType = (formData.value.profile.memberType || '').toLowerCase();
      
      adminFields.value = {
        isVerified: liveData.value.account.isVerified || false,
        foundingMember: liveData.value.account.foundingMember || null
      };
      
      initialData.value = JSON.parse(JSON.stringify(formData.value));
      initialAdminFields.value = JSON.parse(JSON.stringify(adminFields.value));

      // 2. Check for an existing draft
      const draftRef = doc(db, 'draft_profiles', slug);
      const draftSnap = await getDoc(draftRef);
      
      if (draftSnap.exists()) {
        const draftData = draftSnap.data();
        // Normalize draft data too
        if (!draftData.offerings) draftData.offerings = {};
        if (!draftData.offerings.searchTags) draftData.offerings.searchTags = [];
        if (!draftData.media) draftData.media = {};
        if (!draftData.media.galleryUrls) draftData.media.galleryUrls = [];
        
        // Preserve account data from liveData if the draft doesnt include it (non-admin drafts)
        if (!draftData.account) {
          draftData.account = JSON.parse(JSON.stringify(liveData.value.account));
        }

        formData.value = JSON.parse(JSON.stringify(draftData));
        formData.value.profile.memberType = (formData.value.profile.memberType || '').toLowerCase();
        hasPendingDraft.value = true;
        
        if (isAdmin.value) {
          adminFields.value = {
            isVerified: draftData.account?.isVerified ?? adminFields.value.isVerified,
            foundingMember: draftData.account?.foundingMember ?? adminFields.value.foundingMember
          };
        }
        
        initialData.value = JSON.parse(JSON.stringify(formData.value));
        initialAdminFields.value = JSON.parse(JSON.stringify(adminFields.value));
      }
    } else {
      error.value = "Listing not found.";
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
});

// Helper to check if editor value differs from LIVE data
const isDifferentFromLive = (section: string, field: string) => {
  if (!liveData.value) return false;
  const currentVal = (formData.value[section as keyof typeof formData.value] as any)[field];
  const liveVal = (liveData.value[section] || {})[field];
  
  // Handle arrays (tags) or strings with normalization for comparison
  if (Array.isArray(liveVal) || Array.isArray(currentVal)) {
    return JSON.stringify(currentVal || []) !== JSON.stringify(liveVal || []);
  }
  return currentVal !== liveVal;
};

// Helper to revert one field back to the live value
const revertToLive = (section: string, field: string) => {
  if (isAdmin.value && hasPendingDraft.value && isLocked.value) return;
  if (!liveData.value) return;
  const original = (liveData.value[section] || {})[field];
  // Use deep cloning to prevent reference sharing between liveData and formData
  (formData.value[section as keyof typeof formData.value] as any)[field] = 
    (typeof original === 'object' && original !== null) ? JSON.parse(JSON.stringify(original)) : original;
};

const isAdminFieldDifferent = (field: 'memberType' | 'isVerified' | 'foundingMember') => {
  if (!liveData.value) return false;
  if (field === 'memberType') {
    const current = (formData.value.profile.memberType || '').toLowerCase();
    const live = (liveData.value.profile?.memberType || '').toLowerCase();
    return current !== live;
  }

  const current = adminFields.value[field];
  const live = liveData.value.account?.[field];
  return (current ?? null) !== (live ?? null);
};

const revertAdminFieldToLive = (field: 'memberType' | 'isVerified' | 'foundingMember') => {
  if (isAdmin.value && hasPendingDraft.value && isLocked.value) return;
  if (!liveData.value) return;
  if (field === 'memberType') {
    formData.value.profile.memberType = (liveData.value.profile?.memberType || '').toLowerCase();
    return;
  }
  if (field === 'isVerified') {
    adminFields.value.isVerified = !!liveData.value.account?.isVerified;
    return;
  }
  adminFields.value.foundingMember = liveData.value.account?.foundingMember ?? null;
};

const formatBreederTypeLabel = (value: string | null | undefined) => {
  if (!value) return '(none)';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const handleSave = async () => {
  if (!user.value) return;
  isSaving.value = true;

  try {
    const isListingOwner = formData.value.account.ownerUid === user.value.uid;
    const resolvedFbUid = isListingOwner 
      ? (store.state.userData?.facebookUid || formData.value.account.facebookUid || null)
      : (formData.value.account.facebookUid || null);

    const payload = {
      ...formData.value,
      account: {
        ...formData.value.account,
        facebookUid: resolvedFbUid,
        updatedAt: serverTimestamp()
      }
    };

    if (isAdmin.value) {
      const livePayload = {
        ...payload,
        account: {
          ...payload.account,
          ...adminFields.value,
          status: 'published'
        }
      };
      delete (livePayload as any).draft_owner_uid;
      delete (livePayload as any).updatedAt;
      await setDoc(doc(db, 'directory_members', slug), livePayload, { merge: true });
      if (hasPendingDraft.value) {
        await deleteDoc(doc(db, 'draft_profiles', slug));
      }
      create?.({ body: "Changes published successfully!", variant: 'success' });
    } else {
      const draftPayload = {
        ...payload,
        draft_owner_uid: user.value.uid,
        updatedAt: serverTimestamp()
      };
      const { account, ...draftPayloadWithoutAccount } = draftPayload;
      await setDoc(doc(db, 'draft_profiles', slug), draftPayloadWithoutAccount);
      create?.({ body: "Draft submitted for admin approval!", variant: 'success' });
    }
    router.push(`/directory/${slug}`);
  } catch (e: any) {
    console.error(e);
    create?.({ body: "Error saving: " + e.message, variant: 'danger' });
  } finally {
    isSaving.value = false;
  }
};

const addTag = () => {
  const val = tagInput.value.trim();
  if (val && !formData.value.offerings.searchTags.includes(val)) {
    // Replace the array reference for proper reactivity
    formData.value.offerings.searchTags = [...formData.value.offerings.searchTags, val];
    tagInput.value = '';
  }
};

const removeTag = (tag: string) => {
  // Replace the array reference for proper reactivity
  formData.value.offerings.searchTags = formData.value.offerings.searchTags.filter(t => t !== tag);
};
</script>

<template>
  <div class="container py-3">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <BButton :to="`/directory/${slug}`" variant="outline-secondary" class="d-flex align-items-center">
        <i class="bi bi-arrow-left me-2"></i>Back to Profile
      </BButton>
    </div>

    <div v-if="isLoading" class="text-center py-5">
      <BSpinner variant="primary" />
    </div>

    <BAlert v-else-if="error" :model-value="true" variant="danger">{{ error }}</BAlert>

    <div v-else>
      <BCard shadow class="border-0">
          <template #header>
            <div class="py-2 d-flex justify-content-between align-items-center">
              <div>
                <h3 class="mb-0 fw-bold">
                  <i class="bi bi-shop me-1"></i>
                  {{ isAdmin ? 'Moderating' : 'Editing' }}
                  Profile
                  <small class="text-primary">{{ formData.profile.businessName || slug }}</small>
                </h3>
              </div>
              <div v-if="hasPendingDraft" class="d-flex align-items-center gap-2">
                <div class="badge bg-warning text-dark px-3 py-2 shadow-sm animate-pulse">
                  <i class="bi bi-file-earmark-check me-1"></i> Draft Pending Approval
                </div>
                <BButton 
                  v-if="isAdmin" 
                  @click="toggleLock" 
                  :variant="isLocked ? 'outline-primary' : 'primary'" 
                  size="sm" 
                  class="fw-bold"
                >
                  <i :class="isLocked ? 'bi bi-unlock' : 'bi bi-lock-fill'"></i>
                  {{ isLocked ? 'Unlock to Edit' : 'Lock Draft' }}
                </BButton>
              </div>
            </div>
          </template>
          
          <form @submit.prevent="handleSave">
            <!-- Profile Section -->
            <h5 class="mb-3 border-bottom pb-2 fw-bold text-dark d-flex align-items-center gap-2">
              Business Profile
              <span v-if="hasPendingDraft" class="badge bg-light text-muted border" style="font-size: 0.6rem;">COMPARING VS LIVE</span>
            </h5>
            
            <div class="row g-3 mb-4">
              <div class="col-md-6">
                <label class="form-label">Town/Location</label>
                <BFormInput v-model="formData.profile.town" :class="{'bg-diff-highlight': isDifferentFromLive('profile', 'town')}" :disabled="isAdmin && hasPendingDraft && isLocked" required />
                <div v-if="isDifferentFromLive('profile', 'town')" @click="revertToLive('profile', 'town')" class="current-value-hint mt-1 d-flex justify-content-between align-items-center px-2 py-1" :class="{'pe-none': isAdmin && hasPendingDraft && isLocked}">
                  <span><i class="bi bi-globe me-1"></i><strong>Original Live Town:</strong> {{ liveData.profile.town }}</span>
                  <span v-if="!(isAdmin && hasPendingDraft && isLocked)" class="badge bg-secondary-subtle text-secondary border-0 ms-2" style="font-size: 0.6rem;">Click to Revert</span>
                </div>
              </div>
              
              <div class="col-md-6">
                <label class="form-label">Contact Email</label>
                <BFormInput v-model="formData.profile.contactEmail" type="email" :class="{'bg-diff-highlight': isDifferentFromLive('profile', 'contactEmail')}" :disabled="isAdmin && hasPendingDraft && isLocked" required />
                <div v-if="isDifferentFromLive('profile', 'contactEmail')" @click="revertToLive('profile', 'contactEmail')" class="current-value-hint mt-1 d-flex justify-content-between align-items-center px-2 py-1" :class="{'pe-none': isAdmin && hasPendingDraft && isLocked}">
                  <span><i class="bi bi-envelope me-1"></i><strong>Original Live Email:</strong> {{ liveData.profile.contactEmail }}</span>
                  <span v-if="!(isAdmin && hasPendingDraft && isLocked)" class="badge bg-secondary-subtle text-secondary border-0 ms-2" style="font-size: 0.6rem;">Click to Revert</span>
                </div>
              </div>

              <div class="col-12">
                <label class="form-label">Website URL</label>
                <BFormInput v-model="formData.profile.website" type="url" :class="{'bg-diff-highlight': isDifferentFromLive('profile', 'website')}" :disabled="isAdmin && hasPendingDraft && isLocked" placeholder="https://..." />
                <div v-if="isDifferentFromLive('profile', 'website')" @click="revertToLive('profile', 'website')" class="current-value-hint mt-1 d-flex justify-content-between align-items-center px-2 py-1" :class="{'pe-none': isAdmin && hasPendingDraft && isLocked}">
                  <span><i class="bi bi-link-45deg me-1"></i><strong>Original Live Website:</strong> {{ liveData.profile.website || '(none)' }}</span>
                  <span v-if="!(isAdmin && hasPendingDraft && isLocked)" class="badge bg-secondary-subtle text-secondary border-0 ms-2" style="font-size: 0.6rem;">Click to Revert</span>
                </div>
              </div>
            </div>

            <!-- Offerings Section -->
            <h5 class="mb-3 border-bottom pb-2 fw-bold text-dark">What you offer</h5>
            <div class="mb-4">
              <label class="form-label">Description</label>
              <BFormTextarea v-model="formData.offerings.description" rows="4" :class="{'bg-diff-highlight': isDifferentFromLive('offerings', 'description')}" :disabled="isAdmin && hasPendingDraft && isLocked" required />
              
              <!-- Original Description Hint -->
              <div v-if="isDifferentFromLive('offerings', 'description')" class="mt-2">
                <div class="current-value-hint d-block w-100 p-3" @click="revertToLive('offerings', 'description')" style="font-size: 0.85rem;" :class="{'pe-none': isAdmin && hasPendingDraft && isLocked}">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span><i class="bi bi-card-text me-1"></i><strong>Original Live Description:</strong></span>
                    <span v-if="!(isAdmin && hasPendingDraft && isLocked)" class="badge bg-secondary-subtle text-secondary border-0">Click to Revert</span>
                  </div>
                  <div class="text-wrap text-start" style="white-space: pre-wrap; font-weight: normal;">{{ liveData.offerings.description }}</div>
                </div>
              </div>
            </div>
            <div class="mb-4">
              <label class="form-label">Search Tags (Press Enter)</label>
              <BFormInput v-model="tagInput" @keydown.enter.prevent="addTag" placeholder="e.g. Silkies, Fresh Eggs" class="mb-2" :class="{'bg-diff-highlight': isDifferentFromLive('offerings', 'searchTags')}" :disabled="isAdmin && hasPendingDraft && isLocked" />
              
              <!-- Tag Difference Hint -->
              <div v-if="isDifferentFromLive('offerings', 'searchTags')" @click="revertToLive('offerings', 'searchTags')" class="current-value-hint mb-2 d-flex justify-content-between align-items-center px-2 py-1" :class="{'pe-none': isAdmin && hasPendingDraft && isLocked}">
                <span><i class="bi bi-tags me-1"></i><strong>Original Live Tags:</strong> {{ (liveData?.offerings?.searchTags || []).join(', ') || '(none)' }}</span>
                <span v-if="!(isAdmin && hasPendingDraft && isLocked)" class="badge bg-secondary-subtle text-secondary border-0 ms-2" style="font-size: 0.6rem;">Click to Revert</span>
              </div>

              <div class="d-flex flex-wrap gap-2">
                <BBadge v-for="tag in formData.offerings.searchTags" :key="tag" variant="light" class="badge bg-light text-dark border d-flex align-items-center gap-2">
                  {{ tag }}
                  <i v-if="!(isAdmin && hasPendingDraft && isLocked)" @click="removeTag(tag)" class="bi bi-x-circle-fill text-muted cursor-pointer"></i>
                </BBadge>
              </div>
            </div>

            <!-- Gallery Preview -->
            <div class="mb-4">
              <h5 class="mb-3 border-bottom pb-2 fw-bold text-dark">Gallery Preview</h5>
              <div v-if="formData.media.logoUrl || (formData.media.galleryUrls && formData.media.galleryUrls.length > 0)" class="p-3 border rounded bg-light-subtle">
                <BreederGallery
                  id="draft-gallery"
                  :logo="formData.media.logoUrl"
                  :images="formData.media.galleryUrls"
                />
              </div>
              <div v-else class="text-muted small">No gallery images in this draft yet.</div>
            </div>

            <!-- Admin Only Section -->
            <div v-if="isAdmin" class="bg-light p-3 rounded mb-4 border">
              <h5 class="mb-3 text-primary"><i class="bi bi-shield-lock-fill me-2"></i>Admin Controls</h5>
              <div class="mb-3">
                <label class="form-label small">Breeder Type</label>
                <BFormSelect
                  v-model="formData.profile.memberType"
                  :options="breederTypeOptions"
                  class="w-auto"
                  :disabled="hasPendingDraft && isLocked"
                />
                <div v-if="isAdminFieldDifferent('memberType')" @click="revertAdminFieldToLive('memberType')" class="current-value-hint mt-1 d-flex justify-content-between align-items-center px-2 py-1" :class="{'pe-none': hasPendingDraft && isLocked}">
                  <span><i class="bi bi-diagram-3 me-1"></i><strong>Original Live Breeder Type:</strong> {{ formatBreederTypeLabel(liveData?.profile?.memberType) }}</span>
                  <span v-if="!(hasPendingDraft && isLocked)" class="badge bg-secondary-subtle text-secondary border-0 ms-2" style="font-size: 0.6rem;">Click to Revert</span>
                </div>
              </div>
              <BFormCheckbox v-model="adminFields.isVerified" switch class="mb-2" :disabled="hasPendingDraft && isLocked">
                Verified Member
              </BFormCheckbox>
              <div v-if="isAdminFieldDifferent('isVerified')" @click="revertAdminFieldToLive('isVerified')" class="current-value-hint mt-1 mb-2 d-flex justify-content-between align-items-center px-2 py-1" :class="{'pe-none': hasPendingDraft && isLocked}">
                <span><i class="bi bi-patch-check me-1"></i><strong>Original Live Verified Member:</strong> {{ liveData?.account?.isVerified ? 'Yes' : 'No' }}</span>
                <span v-if="!(hasPendingDraft && isLocked)" class="badge bg-secondary-subtle text-secondary border-0 ms-2" style="font-size: 0.6rem;">Click to Revert</span>
              </div>
              <div class="mb-2">
                <label class="form-label small">Founding ID / Rank (optional)</label>
                <BFormInput v-model.number="adminFields.foundingMember" type="number" class="w-25" size="sm" :disabled="hasPendingDraft && isLocked" />
                <div v-if="isAdminFieldDifferent('foundingMember')" @click="revertAdminFieldToLive('foundingMember')" class="current-value-hint mt-1 d-flex justify-content-between align-items-center px-2 py-1" :class="{'pe-none': hasPendingDraft && isLocked}">
                  <span><i class="bi bi-award me-1"></i><strong>Original Live Founding ID:</strong> {{ liveData?.account?.foundingMember ?? '(none)' }}</span>
                  <span v-if="!(hasPendingDraft && isLocked)" class="badge bg-secondary-subtle text-secondary border-0 ms-2" style="font-size: 0.6rem;">Click to Revert</span>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="d-flex justify-content-between align-items-center mt-5">
              <BButton @click="router.back()" variant="link" class="text-muted text-decoration-none">Cancel</BButton>
              
              <div class="d-flex gap-2">
                <BButton v-if="hasPendingDraft" @click="showDiscardModal = true" variant="outline-danger" class="px-4 fw-bold">
                  Discard Draft
                </BButton>
                
                <BButton type="submit" :disabled="isSaving || (!hasChanges && !(isAdmin && hasPendingDraft))" variant="primary" class="px-5 py-2 fw-bold shadow-sm">
                  <BSpinner v-if="isSaving" small class="me-2" />
                  {{ isAdmin ? 'Publish Live' : 'Submit Draft' }}
                </BButton>
              </div>
            </div>
          </form>
        </BCard>
    </div>

    <!-- DISCARD CONFIRMATION MODAL -->
    <BModal v-model="showDiscardModal" title="Discard Pending Draft?" @ok="handleDiscard" :ok-disabled="isDiscarding">
      <p>Are you sure you want to permanently delete your pending draft for <strong>{{ liveData?.profile?.businessName }}</strong>?</p>
      <p class="small text-muted">This action cannot be undone. The editor will be reset to the current live production data.</p>
      
      <template #footer="{ ok, cancel }">
        <BButton variant="secondary" @click="cancel()">Keep Draft</BButton>
        <BButton variant="danger" @click="ok()" :disabled="isDiscarding">
          <BSpinner v-if="isDiscarding" small class="me-1" />
          Delete Draft
        </BButton>
      </template>
    </BModal>

  </div>
</template>

<style scoped>
.cursor-pointer { cursor: pointer; }
.form-label { font-weight: 600; font-size: 0.9rem; color: #4b5563; }

.bg-diff-highlight {
  background-color: #f8fafc !important; /* Extremely subtle grey-blue highlight */
  border-color: #cbd5e1 !important;
}

.current-value-hint {
  display: inline-block;
  background-color: #f1f5f9;
  color: #64748b;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;
}

.current-value-hint:hover {
  background-color: #e2e8f0;
  color: #334155;
  border-color: #cbd5e1;
}

@keyframes pulse-soft {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
}
.animate-pulse {
  animation: pulse-soft 2s infinite ease-in-out;
}
</style>
