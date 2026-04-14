<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import { trackEvent } from '../firebase';
import { BButton, BFormGroup, BFormInput, BFormSelect, BSpinner, BCard } from 'bootstrap-vue-next';

const store = useStore();
const route = useRoute();
const router = useRouter();

const slug = computed(() => route.params.slug as string);
const isStatusPage = computed(() => !!slug.value);

const isLoggedIn = computed(() => store.getters.isLoggedIn);
const isSaving = ref(false);
const isLoadingDraft = ref(false);
const draftData = ref<any>(null);

const form = ref({
  businessName: '',
  town: '',
  memberType: 'breeder'
});

const isFormValid = computed(() => {
  return form.value.businessName.trim().length > 0 && form.value.town.trim().length > 0;
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

const handleLogin = () => {
  store.dispatch('loginWithFacebook');
};

const fetchDraft = async () => {
  if (!slug.value) return;
  isLoadingDraft.value = true;
  try {
    const data = await store.dispatch('fetchBreeder', slug.value);
    if (data) {
      if (data.status === 'published') {
        router.replace(`/directory/${slug.value}`);
        return;
      }
      draftData.value = data;
    } else {
      store.commit('PUSH_TOAST', {
        title: 'Draft Not Found',
        message: "We couldn't find a pending listing with that name.",
        variant: 'warning'
      });
      router.push('/get-listed');
    }
  } catch (e) {
    console.error(e);
  } finally {
    isLoadingDraft.value = false;
  }
};

onMounted(() => {
  if (isStatusPage.value) {
    fetchDraft();
  }
});

watch(slug, (newSlug) => {
  if (newSlug) fetchDraft();
});

const handleSubmit = async () => {
  if (!isFormValid.value) return;

  isSaving.value = true;

  try {
    const newSlug = await store.dispatch('createDraftListing', { ...form.value });
    trackEvent('get_listed_submitted', { member_type: form.value.memberType, breeder_id: newSlug, breeder_name: form.value.businessName });
    router.push(`/get-listed/${newSlug}`);
  } catch (e: any) {
    store.commit('PUSH_TOAST', {
      title: 'Creation Failed',
      message: e.message || "Failed to create listing.",
      variant: 'danger'
    });
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="signup-page py-5">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-lg-10 col-xl-9">
          <BCard shadow class="border-0 signup-card overflow-hidden">
            <div class="row g-0">
              <!-- Sidebar: Why Join? -->
              <div class="col-md-5 bg-sidebar p-4 p-lg-5 text-white">
                <div class="mb-4 text-center">
                  <img src="/ct_chickens_2025_square.png" alt="CT Chickens Logo" class="img-fluid rounded shadow-sm mb-3 border border-white border-opacity-25" style="max-width: 180px;">
                  <h2 class="fw-bold h3">Grow your farm</h2>
                </div>
                
                <div class="why-join-content">
                  <p class="lead-sm mb-4 opacity-90">
                    Connect with the largest local network of chicken enthusiasts in Connecticut.
                  </p>
                  
                  <ul class="list-unstyled feature-list">
                    <li>
                      <i class="bi bi-graph-up-arrow me-2 text-warning"></i>
                      <strong>12,000+ Members</strong>
                      <p class="small opacity-75">Get immediate visibility with our massive, active community.</p>
                    </li>
                    <li>
                      <i class="bi bi-shield-check me-2 text-warning"></i>
                      <strong>Build Trust</strong>
                      <p class="small opacity-75">Apply for verification to prove your standing in the community.</p>
                    </li>
                    <li>
                      <i class="bi bi-google me-2 text-warning"></i>
                      <strong>SEO Ranking</strong>
                      <p class="small opacity-75">Our directory is indexed by Google, bringing you customers from outside Facebook.</p>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Main Content: The Form or Status -->
              <div class="col-md-7 p-4 p-lg-5 bg-white">
                
                <!-- LOADING STATE -->
                <div v-if="isLoadingDraft" class="text-center py-5">
                  <BSpinner variant="primary" />
                  <p class="text-muted mt-3">Loading your listing...</p>
                </div>

                <!-- STATUS PAGE: Pending Approval -->
                <div v-else-if="isStatusPage" class="status-content text-center py-4">
                  <div class="mb-4">
                    <div class="status-icon-wrapper mb-3">
                      <i class="bi bi-hourglass-split text-warning display-4"></i>
                    </div>
                    <h1 class="fw-bold h3 text-dark mb-2">Listing Submitted!</h1>
                    <p class="text-muted fs-5">
                      Your farm, <strong>{{ draftData?.name || slug }}</strong>, is currently pending admin approval.
                    </p>
                  </div>

                  <div class="alert alert-warning border-0 shadow-sm text-start mb-4 py-3">
                    <h6 class="fw-bold mb-2"><i class="bi bi-info-circle-fill me-2"></i>What's next?</h6>
                    <ul class="small mb-0 ps-3">
                      <li class="mb-1">Our team will review your basic details within 24-48 hours.</li>
                      <li class="mb-1">Once approved, you'll receive a notification to complete your full profile.</li>
                      <li>You can then add your gallery, inventory, and contact links.</li>
                    </ul>
                  </div>

                  <div class="d-grid gap-2">
                    <BButton variant="primary" to="/" size="lg" class="py-3 fw-bold shadow-sm">
                      Return to Home
                    </BButton>
                    <BButton variant="light" @click="router.back()" class="text-muted">
                      Go Back
                    </BButton>
                  </div>
                </div>

                <!-- SIGNUP FORM -->
                <div v-else>
                  <div class="mb-4">
                    <h1 class="fw-bold h3 text-dark mb-2">Join Our Member Directory</h1>
                    <div class="onboarding-hint">
                      Provide a few details about yourself and your business to get listed.
                    </div>
                  </div>

                  <div v-if="!isLoggedIn" class="text-center py-5 auth-required">
                    <div class="mb-4">
                      <i class="bi bi-person-lock fs-1 text-muted opacity-50"></i>
                    </div>
                    <h5 class="fw-bold">Facebook Login Required</h5>
                    <p class="text-muted mb-4">We use Facebook to verify identities and prevent spam in our community.</p>
                    <BButton variant="primary" @click="handleLogin" class="btn-facebook px-4 py-3 fw-bold shadow-sm w-100">
                      <i class="bi bi-facebook me-2"></i>Login with Facebook
                    </BButton>
                  </div>

                  <form v-else @submit.prevent="handleSubmit" class="signup-form">
                    <BFormGroup label="Business Name" label-for="biz-name" class="mb-4 custom-label">
                      <BFormInput
                        id="biz-name"
                        v-model="form.businessName"
                        placeholder="e.g. Sunny Side Farm"
                        class="form-control-lg custom-input"
                        required
                        :disabled="isSaving"
                      />
                    </BFormGroup>

                    <BFormGroup label="Town" label-for="town" class="mb-4 custom-label">
                      <BFormInput
                        id="town"
                        v-model="form.town"
                        placeholder="e.g. Lebanon, CT"
                        class="form-control-lg custom-input"
                        required
                        :disabled="isSaving"
                      />
                    </BFormGroup>

                    <BFormGroup label="I am a..." label-for="type" class="mb-5 custom-label">
                      <BFormSelect
                        id="type"
                        v-model="form.memberType"
                        :options="breederTypeOptions"
                        class="form-select-lg custom-input"
                        :disabled="isSaving"
                      />
                    </BFormGroup>

                    <div class="d-flex align-items-center justify-content-between gap-3 pt-3 border-top mt-5">
                      <BButton
                        variant="light"
                        @click="router.back()"
                        :disabled="isSaving"
                        class="btn-cancel px-4 py-3 fw-bold"
                      >
                        Cancel
                      </BButton>
                      
                      <BButton
                        type="submit"
                        variant="primary"
                        size="lg"
                        :disabled="isSaving || !isFormValid"
                        class="btn-continue px-5 py-3 fw-bold shadow-sm flex-grow-1"
                      >
                        <BSpinner v-if="isSaving" small class="me-2" />
                        Continue
                        <i v-if="!isSaving" class="bi bi-arrow-right ms-2"></i>
                      </BButton>
                    </div>
                  </form>
                </div>

              </div>
            </div>
          </BCard>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.signup-page {
  min-height: 85vh;
  background-color: #f8fafc;
}

.signup-card {
  border-radius: 1.25rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
}

.bg-sidebar {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  position: relative;
}

.bg-sidebar::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  pointer-events: none;
}

.brightness-0-invert {
  filter: brightness(0) invert(1);
}

.onboarding-hint {
  color: #64748b;
  font-size: 1.1rem;
  font-weight: 500;
  border-left: 4px solid #3b82f6;
  padding-left: 1rem;
}

.custom-label :deep(label) {
  font-weight: 700;
  font-size: 0.95rem;
  color: #334155;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.custom-input {
  border: 2px solid #e2e8f0;
  border-radius: 0.75rem;
  transition: all 0.2s;
  padding: 0.75rem 1.25rem;
}

.custom-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.feature-list li {
  margin-bottom: 1.5rem;
}

.feature-list strong {
  display: block;
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
}

.btn-facebook {
  background-color: #1877f2;
  border: none;
  border-radius: 0.75rem;
}

.btn-continue {
  border-radius: 0.75rem;
}

.btn-cancel {
  border-radius: 0.75rem;
  color: #64748b;
  border: 2px solid #e2e8f0;
}

.btn-cancel:hover {
  background-color: #f1f5f9;
  color: #334155;
}

.status-icon-wrapper {
  animation: pulse-warn 2s infinite ease-in-out;
}

@keyframes pulse-warn {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@media (max-width: 767px) {
  .bg-sidebar {
    padding: 3rem 1.5rem !important;
  }
}
</style>
