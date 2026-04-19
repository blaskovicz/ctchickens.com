<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import {
  BContainer, BRow, BCol, BCard, BCardBody, BCardHeader,
  BFormGroup, BFormInput, BButton, BSpinner, BBadge, BAlert,
  useToast
} from 'bootstrap-vue-next';

const store = useStore();
const router = useRouter();
const { create } = useToast();

const authReady = computed(() => store.getters.authReady);
const isLoggedIn = computed(() => store.getters.isLoggedIn);
const user = computed(() => store.state.user);
const userData = computed(() => store.state.userData);

const localEmailInput = ref('');

const facebookEmail = computed(() => user.value?.email ?? userData.value?.email ?? null);
const verifiedLocalEmail = computed(() => userData.value?.localEmail ?? null);
const pendingLocalEmail = computed(() => userData.value?.pendingLocalEmail ?? null);

const effectiveEmail = computed(() => verifiedLocalEmail.value ?? facebookEmail.value ?? null);

const hasNoEmail = computed(() => !facebookEmail.value && !verifiedLocalEmail.value && !pendingLocalEmail.value);

watch(
  () => `${userData.value?.pendingLocalEmail}|${userData.value?.localEmail}`,
  () => {
    localEmailInput.value = pendingLocalEmail.value ?? verifiedLocalEmail.value ?? '';
  },
  { immediate: true }
);

// Auth guard: once the auth state resolves, redirect unauthenticated visitors
watch(authReady, (ready) => {
  if (ready && !isLoggedIn.value) {
    router.push('/');
  }
});

onMounted(() => {
  if (authReady.value && !isLoggedIn.value) {
    router.push('/');
  }
});

const isSaving = ref(false);

const hasUnsavedEmailChanges = computed(
  () => localEmailInput.value.trim() !== (pendingLocalEmail.value ?? verifiedLocalEmail.value ?? '')
);

const handleSave = async () => {
  if (!isLoggedIn.value) return;
  const trimmed = localEmailInput.value.trim();
  if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    create?.({ body: 'Please enter a valid email address.', variant: 'danger' });
    return;
  }
  isSaving.value = true;
  try {
    const action = await store.dispatch('updateLocalEmail', trimmed);
    if (action === 'cleared') {
      create?.({ body: 'Notification email removed.', variant: 'success' });
    } else {
      create?.({ body: `Verification email sent to ${trimmed}`, variant: 'success' });
    }
  } catch (err: any) {
    create?.({ body: `Save failed: ${err.message}`, variant: 'danger' });
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <BContainer class="py-5" style="max-width: 640px;">

    <!-- Skeleton while auth resolves -->
    <div v-if="!authReady" class="text-center py-5">
      <BSpinner variant="primary" />
    </div>

    <template v-else-if="isLoggedIn">
      <h4 class="fw-bold mb-4">My Profile</h4>

      <!-- No-email nudge -->
      <BAlert v-if="hasNoEmail" variant="warning" show class="mb-4">
        We couldn't get an email from Facebook — add a notification email below so we can reach you.
      </BAlert>

      <!-- Identity (read-only) -->
      <BCard class="mb-4 border-0 shadow-sm">
        <BCardHeader class="bg-white border-bottom fw-semibold text-muted small text-uppercase">
          Account
        </BCardHeader>
        <BCardBody>
          <BRow class="align-items-center g-3">
            <BCol cols="auto">
              <img
                v-if="user?.photoURL"
                :src="user.photoURL"
                alt="Profile photo"
                width="56"
                height="56"
                class="rounded-circle border"
              >
              <div
                v-else
                class="rounded-circle border bg-secondary d-flex align-items-center justify-content-center text-white fw-bold"
                style="width:56px;height:56px;font-size:1.4rem;"
              >
                {{ user?.displayName?.charAt(0) ?? '?' }}
              </div>
            </BCol>
            <BCol>
              <div class="fw-semibold">{{ user?.displayName ?? 'Unknown' }}</div>
              <div class="small text-muted">
                <i class="bi bi-facebook me-1"></i>Linked via Facebook
              </div>
            </BCol>
          </BRow>

          <hr class="my-3">

          <BFormGroup label="Facebook Email" label-class="small fw-semibold text-muted mb-1">
            <div class="d-flex align-items-center gap-2">
              <span v-if="facebookEmail" class="text-dark">{{ facebookEmail }}</span>
              <span v-else class="text-muted fst-italic small">Not provided by Facebook</span>
              <BBadge variant="secondary" class="ms-1">Read-only</BBadge>
            </div>
            <div class="form-text">
              This address comes from your Facebook account and cannot be changed here.
            </div>
          </BFormGroup>
        </BCardBody>
      </BCard>

      <!-- Notification email (editable) -->
      <BCard class="border-0 shadow-sm">
        <BCardHeader class="bg-white border-bottom fw-semibold text-muted small text-uppercase">
          Notifications
        </BCardHeader>
        <BCardBody>
          <!-- Effective email summary -->
          <div class="mb-3 p-3 rounded bg-light small">
            <span class="fw-semibold">Notifications are currently sent to: </span>
            <span v-if="effectiveEmail" class="text-dark">{{ effectiveEmail }}</span>
            <span v-else class="text-danger fw-semibold">No email — you won't receive notifications</span>
          </div>

          <BFormGroup
            label="Notification Email"
            label-class="small fw-semibold text-muted mb-1"
          >
            <div class="d-flex align-items-center flex-wrap gap-2 mb-2">
              <BBadge v-if="verifiedLocalEmail && !pendingLocalEmail" variant="success">Verified</BBadge>
              <BBadge v-if="pendingLocalEmail" variant="warning" text-variant="dark">Unverified — using Facebook email as fallback</BBadge>
              <BButton
                v-if="pendingLocalEmail && !hasUnsavedEmailChanges"
                variant="outline-primary"
                size="sm"
                :disabled="isSaving"
                @click="handleSave"
              >
                Re-send verification email
              </BButton>
            </div>
            <BFormInput
              id="local-email-input"
              v-model="localEmailInput"
              type="email"
              placeholder="your@email.com"
              :disabled="isSaving"
            />
            <div class="form-text">
              Once verified, this replaces your Facebook email for all notifications.
              Until then, we fall back to your Facebook email.
            </div>
          </BFormGroup>

          <div class="d-flex justify-content-end gap-2 mt-3">
            <BButton
              v-if="hasUnsavedEmailChanges"
              variant="outline-secondary"
              size="sm"
              :disabled="isSaving"
              @click="localEmailInput = pendingLocalEmail ?? verifiedLocalEmail ?? ''"
            >
              Cancel
            </BButton>
            <BButton
              :variant="!localEmailInput.trim() && (verifiedLocalEmail || pendingLocalEmail) ? 'danger' : 'primary'"
              size="sm"
              :disabled="isSaving || !hasUnsavedEmailChanges"
              @click="handleSave"
            >
              <BSpinner v-if="isSaving" small class="me-1" />
              {{ !localEmailInput.trim() && (verifiedLocalEmail || pendingLocalEmail) ? 'Remove email' : 'Save' }}
            </BButton>
          </div>
        </BCardBody>
      </BCard>
    </template>

  </BContainer>
</template>
