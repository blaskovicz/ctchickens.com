<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast, BButton, BSpinner } from 'bootstrap-vue-next';
import { useBreederUtils } from '../composables/useBreederUtils';

const store = useStore();
const { create } = useToast();
const { generateSlug } = useBreederUtils();

const suggested = computed(() => store.getters.suggestedClaim);
const user = computed(() => store.getters.currentUser);
const userData = computed(() => store.state.userData);
const activeClaims = computed(() => store.state.activeClaims);

// Mirrors resolveEmail in Cloud Functions: prefer localEmail, fall back to OAuth email
const effectiveEmail = computed(() =>
  userData.value?.localEmail || userData.value?.email || user.value?.email || null
);

const isSubmitting = ref(false);
const isSuccess = ref(false);

const isPending = computed(() => {
  if (!suggested.value) return false;
  const slug = generateSlug(suggested.value.name);
  return activeClaims.value.includes(slug);
});

const submitClaim = async () => {
  if (!suggested.value || !user.value) return;
  
  // FIX: Use the shared utility to generate a clean slug (removing parentheses, etc)
  const businessSlug = generateSlug(suggested.value.name);
  isSubmitting.value = true;
  
  try {
    const claimRef = doc(db, 'claim_requests', businessSlug);
    await setDoc(claimRef, {
      businessName: suggested.value.name,
      businessSlug: businessSlug,
      requesterUid: user.value.uid,
      requesterEmail: effectiveEmail.value,
      requesterName: user.value.displayName,
      requesterPhotoURL: user.value.photoURL,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    
    isSuccess.value = true;
    
    // Update local state so the banner disappears immediately
    const currentClaims = [...store.state.activeClaims, businessSlug];
    store.commit('SET_ACTIVE_CLAIMS', currentClaims);
    
    create?.({ title: 'Success', body: "Claim request submitted!", variant: 'success' });

  } catch (e: any) {
    console.error("Claim Error:", e);
    create?.({ title: 'Error', body: `Error submitting claim: ${e.message}`, variant: 'danger' });
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <!-- Removed isSuccess check here so we only use the Toast for success -->
  <div v-if="suggested && !isSuccess" class="alert alert-info border-0 rounded-0 m-0 shadow-sm">
    <div class="container d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
      <div class="d-flex align-items-center gap-3">
        <div class="display-6"><i class="bi bi-shop"></i></div>
        <div>
          <h5 class="mb-0">Is this your business? <strong>{{ suggested.name }}</strong></h5>
          <p class="mb-0 small opacity-75">
            {{ isPending 
               ? "Your claim request is pending approval by an administrator." 
               : "We found a matching listing for your email. Claim it to manage your profile." 
            }}
          </p>
        </div>
      </div>
      
      <div v-if="isPending" class="d-flex align-items-center gap-2 text-white bg-white bg-opacity-10 px-3 py-2 rounded shadow-sm border border-white border-opacity-10">
        <i class="bi bi-clock-history small"></i>
        <span class="small fw-bold text-uppercase tracking-wider">Pending Approval</span>
      </div>

      <BButton 
        v-else
        @click="submitClaim" 
        :disabled="isSubmitting"
        variant="light"
        class="px-4 shadow-sm d-flex align-items-center gap-2 text-primary fw-bold claim-btn"
      >
        <BSpinner v-if="isSubmitting" small />
        <i v-else class="bi bi-check-circle-fill"></i>
        {{ isSubmitting ? 'Submitting...' : 'Claim Listing' }}
      </BButton>
    </div>
  </div>
</template>

<style scoped>
.alert-info {
  background-color: var(--primary-color);
  color: white;
}
</style>
