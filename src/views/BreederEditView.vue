<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { db } from '../firebase';
import { 
  collection, getDocs, doc, getDoc, setDoc, deleteDoc, 
  serverTimestamp, updateDoc 
} from 'firebase/firestore';
import { 
  useToast, 
  BAlert, BBadge, BButton, BCard, BFormCheckbox, BFormInput, BFormTextarea, BSpinner, BModal 
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
const hasPendingDraft = ref(false);
const isLocked = ref(true); // Admin-only: Lock fields during review

// ... (onMounted, isDifferentFromLive, revertToLive, handleSave, addTag, removeTag)

const toggleLock = () => {
  isLocked.value = !isLocked.value;
};

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

    create?.({ body: "Pending draft discarded. Editor reset to live version.", variant: 'info' });
  } catch (e: any) {
    create?.({ body: "Discard error: " + e.message, variant: 'danger' });
  } finally {
    isDiscarding.value = false;
  }
};

// Form Data (The Editor State)
const formData = ref({
  profile: { businessName: '', town: '', contactEmail: '', website: '' },
  offerings: { description: '', searchTags: [] as string[] },
  media: { logoUrl: '', galleryUrls: [] as string[] },
  account: { ownerUid: '', status: 'draft' }
});

// Admin-only fields
const adminFields = ref({
  isVerified: false,
  foundingMember: null as number | null
});

onMounted(async () => {
  try {
    // 1. Fetch the LIVE data
    const docRef = doc(db, 'directory_members', slug);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      liveData.value = docSnap.data();
      
      // Default: Initialize editor with live data
      formData.value = JSON.parse(JSON.stringify(liveData.value));
      
      adminFields.value = {
        isVerified: liveData.value.account.isVerified || false,
        foundingMember: liveData.value.account.foundingMember || null
      };

      // 2. Check for an existing draft
      const draftRef = doc(db, 'draft_profiles', slug);
      const draftSnap = await getDoc(draftRef);
      
      if (draftSnap.exists()) {
        const draftData = draftSnap.data();
        // AUTO-LOAD: Overwrite editor with draft values
        formData.value = JSON.parse(JSON.stringify(draftData));
        hasPendingDraft.value = true;
        
        // If admin, we also want to ensure the adminFields are synced with what's in the draft
        // or kept from live if they aren't in the draft
        if (isAdmin.value) {
          adminFields.value = {
            isVerified: draftData.account?.isVerified ?? adminFields.value.isVerified,
            foundingMember: draftData.account?.foundingMember ?? adminFields.value.foundingMember
          };
        }
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
  const liveVal = liveData.value[section][field];
  
  // Handle arrays (tags) or strings
  if (Array.isArray(liveVal)) {
    return JSON.stringify(currentVal) !== JSON.stringify(liveVal);
  }
  return currentVal !== liveVal;
};

// Helper to revert one field back to the live value
const revertToLive = (section: string, field: string) => {
  if (!liveData.value) return;
  (formData.value[section as keyof typeof formData.value] as any)[field] = liveData.value[section][field];
};

const handleSave = async () => {
  if (!user.value) return;
  isSaving.value = true;

  try {
    // Only denormalize facebookUid if the current user is the OWNER. 
    // If it's an admin, we just preserve what's in the formData.
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
      await setDoc(doc(db, 'directory_members', slug), livePayload, { merge: true });
      
      // CLEANUP: If there was a pending draft, remove it now that it's live
      if (hasPendingDraft.value) {
        await deleteDoc(doc(db, 'draft_profiles', slug));
      }
      
      create?.({ body: "Changes published successfully!", variant: 'success' });
    } else {
      const draftPayload = {
        ...payload,
        account: {
          ...payload.account,
          ownerUid: user.value.uid
        }
      };
      await setDoc(doc(db, 'draft_profiles', slug), draftPayload);
      create?.({ body: "Draft submitted for admin approval!", variant: 'success' });
    }
    // FIX: Redirect to the profile page instead of the main directory
    router.push(`/directory/${slug}`);
  } catch (e: any) {
    console.error(e);
    create?.({ body: "Error saving: " + e.message, variant: 'danger' });
  } finally {
    isSaving.value = false;
  }
};

const addTag = (event: any) => {
  const val = event.target.value.trim();
  if (val && !formData.value.offerings.searchTags.includes(val)) {
    formData.value.offerings.searchTags.push(val);
    event.target.value = '';
  }
};

const removeTag = (tag: string) => {
  formData.value.offerings.searchTags = formData.value.offerings.searchTags.filter(t => t !== tag);
};
</script>

<template>
  <div class="container py-3">
    <div class="d-flex justify-content-betweenF align-items-center mb-4">
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
                <div v-if="isDifferentFromLive('profile', 'town')" @click="revertToLive('profile', 'town')" class="current-value-hint mt-1">
                  <i class="bi bi-globe me-1"></i> Current: {{ liveData.profile.town }}
                </div>
              </div>
              
              <div class="col-md-6">
                <label class="form-label">Contact Email</label>
                <BFormInput v-model="formData.profile.contactEmail" type="email" :class="{'bg-diff-highlight': isDifferentFromLive('profile', 'contactEmail')}" :disabled="isAdmin && hasPendingDraft && isLocked" required />
                <div v-if="isDifferentFromLive('profile', 'contactEmail')" @click="revertToLive('profile', 'contactEmail')" class="current-value-hint mt-1">
                  <i class="bi bi-envelope me-1"></i> Current: {{ liveData.profile.contactEmail }}
                </div>
              </div>

              <div class="col-12">
                <label class="form-label">Website URL</label>
                <BFormInput v-model="formData.profile.website" type="url" :class="{'bg-diff-highlight': isDifferentFromLive('profile', 'website')}" :disabled="isAdmin && hasPendingDraft && isLocked" placeholder="https://..." />
                <div v-if="isDifferentFromLive('profile', 'website')" @click="revertToLive('profile', 'website')" class="current-value-hint mt-1">
                  <i class="bi bi-link-45deg me-1"></i> Current: {{ liveData.profile.website || '(none)' }}
                </div>
              </div>
            </div>

            <!-- Offerings Section -->
            <h5 class="mb-3 border-bottom pb-2 fw-bold text-dark">What you offer</h5>
            <div class="mb-4">
              <label class="form-label">Description</label>
              <BFormTextarea v-model="formData.offerings.description" rows="4" :class="{'bg-diff-highlight': isDifferentFromLive('offerings', 'description')}" :disabled="isAdmin && hasPendingDraft && isLocked" required />
              <div v-if="isDifferentFromLive('offerings', 'description')" @click="revertToLive('offerings', 'description')" class="current-value-hint mt-1">
                <i class="bi bi-arrow-counterclockwise"></i> Revert to Live Description
              </div>
            </div>
            <div class="mb-4">
              <label class="form-label">Search Tags (Press Enter)</label>
              <BFormInput @keydown.enter.prevent="addTag" placeholder="e.g. Silkies, Fresh Eggs" class="mb-2" :class="{'bg-diff-highlight': isDifferentFromLive('offerings', 'searchTags')}" :disabled="isAdmin && hasPendingDraft && isLocked" />
              
              <!-- Tag Difference Hint -->
              <div v-if="isDifferentFromLive('offerings', 'searchTags')" @click="revertToLive('offerings', 'searchTags')" class="current-value-hint mb-2">
                <i class="bi bi-tags me-1"></i> Current: {{ liveData.offerings.searchTags.join(', ') || '(none)' }}
              </div>

              <div class="d-flex flex-wrap gap-2">
                <BBadge v-for="tag in formData.offerings.searchTags" :key="tag" variant="light" class="badge bg-light text-dark border d-flex align-items-center gap-2">
                  {{ tag }}
                  <i v-if="!(isAdmin && hasPendingDraft && isLocked)" @click="removeTag(tag)" class="bi bi-x-circle-fill text-muted cursor-pointer"></i>
                </BBadge>
              </div>
            </div>

            <!-- Admin Only Section -->
            <div v-if="isAdmin" class="bg-light p-3 rounded mb-4 border">
              <h5 class="mb-3 text-primary"><i class="bi bi-shield-lock-fill me-2"></i>Admin Controls</h5>
              <BFormCheckbox v-model="adminFields.isVerified" switch class="mb-2" :disabled="hasPendingDraft && isLocked">
                Verified Member
              </BFormCheckbox>
              <div class="mb-2">
                <label class="form-label small">Founding ID / Rank (optional)</label>
                <BFormInput v-model.number="adminFields.foundingMember" type="number" class="w-25" size="sm" :disabled="hasPendingDraft && isLocked" />
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="d-flex justify-content-between align-items-center mt-5">
              <BButton @click="router.back()" variant="link" class="text-muted text-decoration-none">Cancel</BButton>
              
              <div class="d-flex gap-2">
                <BButton v-if="hasPendingDraft" @click="showDiscardModal = true" variant="outline-danger" class="px-4 fw-bold">
                  Discard Draft
                </BButton>
                
                <BButton type="submit" :disabled="isSaving" variant="primary" class="px-5 py-2 fw-bold shadow-sm">
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
