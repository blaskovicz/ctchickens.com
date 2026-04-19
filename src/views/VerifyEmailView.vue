<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  BContainer, BCard, BCardBody, BButton, BSpinner,
} from 'bootstrap-vue-next';

const route = useRoute();
const router = useRouter();
const store = useStore();
const isLoggedIn = computed(() => store.getters.isLoggedIn);

type VerifyStatus = 'pending' | 'success' | 'error';
const status = ref<VerifyStatus>('pending');
const errorMessage = ref('');

onMounted(async () => {
  const { uid, email, ts, token } = route.query as Record<string, string>;

  if (!uid || !email || !ts || !token) {
    errorMessage.value = 'Invalid verification link — one or more required parameters are missing.';
    status.value = 'error';
    return;
  }

  try {
    const functions = getFunctions();
    const verifyLocalEmail = httpsCallable(functions, 'verifyLocalEmail');
    await verifyLocalEmail({ uid, email, ts, token });
    if (isLoggedIn.value) {
      await store.dispatch('fetchUserData', store.state.user!.uid);
    }
    status.value = 'success';
  } catch (err: any) {
    errorMessage.value =
      err?.message ?? 'Verification failed. The link may be expired or invalid.';
    status.value = 'error';
  }
});
</script>

<template>
  <BContainer class="py-5" style="max-width: 520px;">
    <BCard class="border-0 shadow-sm text-center">
      <BCardBody class="py-5 px-4">

        <!-- Pending -->
        <template v-if="status === 'pending'">
          <BSpinner variant="primary" style="width:2.5rem;height:2.5rem;" class="mb-4" />
          <p class="text-muted mb-0">Verifying your email address...</p>
        </template>

        <!-- Success -->
        <template v-else-if="status === 'success'">
          <div
            class="d-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 mx-auto mb-4"
            style="width:64px;height:64px;"
          >
            <i class="bi bi-check-circle-fill text-success" style="font-size:2rem;"></i>
          </div>
          <h4 class="fw-bold mb-2">Email verified!</h4>
          <p class="text-muted mb-4">
            Your notification email address has been confirmed. Future notifications will be sent there.
          </p>
          <BButton v-if="isLoggedIn" variant="primary" @click="router.push('/profile')">
            Go to profile
          </BButton>
          <BButton v-else variant="primary" @click="router.push('/')">
            Login to continue
          </BButton>
        </template>

        <!-- Error -->
        <template v-else>
          <div
            class="d-flex align-items-center justify-content-center rounded-circle bg-danger bg-opacity-10 mx-auto mb-4"
            style="width:64px;height:64px;"
          >
            <i class="bi bi-x-circle-fill text-danger" style="font-size:2rem;"></i>
          </div>
          <h4 class="fw-bold mb-2">Verification failed</h4>
          <p class="text-muted mb-4">{{ errorMessage }}</p>
          <BButton v-if="isLoggedIn" variant="outline-primary" @click="router.push('/profile')">
            Back to profile
          </BButton>
          <BButton v-else variant="outline-primary" @click="router.push('/')">
            Login to continue
          </BButton>
        </template>

      </BCardBody>
    </BCard>
  </BContainer>
</template>
