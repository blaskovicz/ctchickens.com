<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { formatRelativeTime } from '../composables/useBreederUtils';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { db } from '../firebase';
import {
  doc, getDoc, addDoc, collection, serverTimestamp, writeBatch, onSnapshot
} from 'firebase/firestore';
import { BButton, BBadge, BSpinner, BModal, useToast } from 'bootstrap-vue-next';
import type { Classified, DraftClassified } from '../types';

const route = useRoute();
const router = useRouter();
const store = useStore();
const { create } = useToast();

const docId = route.params.docId as string;

const classified = ref<Classified | null>(null);
const draftClassified = ref<DraftClassified | null>(null);
const isLoading = ref(true);
const isActing = ref(false);
const showPublishModal = ref(false);
const showDiscardModal = ref(false);
const showMessageModal = ref(false);
const isOpeningThread = ref(false);
let unsubscribeClassified: (() => void) | null = null;

const user = computed(() => store.state.user);
const isAdmin = computed(() => store.getters.isAdmin);
const isLoggedIn = computed(() => store.getters.isLoggedIn);
const isOwner = computed(() => !!user.value && (classified.value?.owner_uid === user.value.uid || draftClassified.value?.owner_uid === user.value.uid));
const isDraft = computed(() => !!draftClassified.value && !classified.value);
const publishedFarms = computed(() => (store.getters.myBreeders as any[]).filter((b: any) => b.status === 'published'));

const CATEGORY_LABELS: Record<string, string> = {
  iso: 'In Search Of',
  for_sale: 'For Sale',
  rehoming: 'Rehoming',
  hatching_eggs: 'Hatching Eggs',
};

const daysUntilExpiry = computed(() => {
  if (!classified.value?.expires_at) return null;
  const d = classified.value.expires_at.toDate ? classified.value.expires_at.toDate() : new Date(classified.value.expires_at);
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
});

const canRenew = computed(() => {
  if (!classified.value || !isOwner.value) return false;
  if (classified.value.status !== 'active') return false;
  if (classified.value.renewal_count >= classified.value.max_renewals) return false;
  const days = daysUntilExpiry.value;
  return days !== null && days <= 2;
});

const formatDate = (ts: any) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

onMounted(async () => {
  try {
    // Attach a real-time listener on the classifieds doc so CF-driven updates
    // (e.g. renewal) are reflected automatically without optimistic writes.
    unsubscribeClassified = onSnapshot(
      doc(db, 'classifieds', docId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'active' || store.getters.isAdmin || data.owner_uid === user.value?.uid) {
            classified.value = { id: snap.id, ...data } as Classified;
          }
        }
        isLoading.value = false;
      },
      (e: any) => {
        create?.({ body: `Failed to load listing: ${e.message}`, variant: 'danger' });
        isLoading.value = false;
      },
    );

    // If no live doc exists (or access is denied), fall back to draft lookup.
    const liveSnap = await getDoc(doc(db, 'classifieds', docId));
    if (!liveSnap.exists() && user.value) {
      const draftSnap = await getDoc(doc(db, 'draft_classifieds', docId));
      if (draftSnap.exists()) {
        const data = draftSnap.data();
        if (isAdmin.value || data.owner_uid === user.value.uid) {
          draftClassified.value = { id: draftSnap.id, ...data } as DraftClassified;
        }
      }
      // The snapshot listener will not fire for a doc that doesn't exist,
      // so clear the loading state here for the draft path.
      isLoading.value = false;
    }
  } catch (e: any) {
    create?.({ body: `Failed to load listing: ${e.message}`, variant: 'danger' });
    isLoading.value = false;
  }
});

onUnmounted(() => {
  unsubscribeClassified?.();
});

const handleRenew = async () => {
  if (!canRenew.value || isActing.value) return;
  isActing.value = true;
  try {
    await addDoc(collection(db, 'classifieds', docId, 'actions'), {
      action: 'renew',
      owner_uid: user.value!.uid,
      created_at: serverTimestamp(),
    });
    // No optimistic update — the onSnapshot listener picks up the CF's write
    // to expires_at / renewal_count once it processes the action.
    create?.({ body: 'Renewal requested — your listing will update shortly.', variant: 'info' });
  } catch (e: any) {
    create?.({ body: `Renewal failed: ${e.message}`, variant: 'danger' });
  } finally {
    isActing.value = false;
  }
};

const handleDiscard = async () => {
  if (!isOwner.value || isActing.value || !classified.value) return;
  isActing.value = true;
  try {
    await addDoc(collection(db, 'classifieds', docId, 'actions'), {
      action: 'discard',
      owner_uid: user.value!.uid,
      created_at: serverTimestamp(),
    });
    classified.value = { ...classified.value!, status: 'discarded' };
    store.commit('SET_CLASSIFIEDS', store.state.classifieds.filter((c: Classified) => c.id !== docId));
    create?.({ body: 'Listing closed.', variant: 'info' });
    isActing.value = false;
  } catch (e: any) {
    create?.({ body: `Failed to close listing: ${e.message}`, variant: 'danger' });
    isActing.value = false;
  }
};

const handleApprove = async () => {
  if (!isAdmin.value || !draftClassified.value || isActing.value) return;
  isActing.value = true;
  try {
    const { id, ...snapshot } = draftClassified.value;
    const batch = writeBatch(db);
    batch.set(doc(db, 'draft_classified_history', docId), {
      draft_meta: { status: 'approved', archivedAt: serverTimestamp(), owner_uid: snapshot.owner_uid },
      snapshot,
    });
    batch.delete(doc(db, 'draft_classifieds', docId));
    await batch.commit();
    create?.({ body: 'Classified approved and published!', variant: 'success' });
    router.push('/classified');
  } catch (e: any) {
    create?.({ body: `Approval failed: ${e.message}`, variant: 'danger' });
    isActing.value = false;
  }
};

const handleReject = async () => {
  if (!isAdmin.value || !draftClassified.value || isActing.value) return;
  isActing.value = true;
  try {
    const { id, ...snapshot } = draftClassified.value;
    const batch = writeBatch(db);
    batch.set(doc(db, 'draft_classified_history', docId), {
      draft_meta: { status: 'rejected', archivedAt: serverTimestamp(), owner_uid: snapshot.owner_uid },
      snapshot,
    });
    batch.delete(doc(db, 'draft_classifieds', docId));
    await batch.commit();
    create?.({ body: 'Classified rejected.', variant: 'info' });
    router.push('/classified');
  } catch (e: any) {
    create?.({ body: `Rejection failed: ${e.message}`, variant: 'danger' });
    isActing.value = false;
  }
};

const handleMessage = async (farmSlug?: string | null) => {
  if (!classified.value || isOpeningThread.value) return;
  showMessageModal.value = false;
  isOpeningThread.value = true;
  try {
    await store.dispatch('openPeerThread', {
      targetUid: classified.value.owner_uid,
      senderFarmSlug: farmSlug || undefined,
      classifiedId: docId,
    });
  } catch (e: any) {
    create?.({ body: `Failed to open conversation: ${e.message}`, variant: 'danger' });
  } finally {
    isOpeningThread.value = false;
  }
};

const activeData = computed(() => classified.value || draftClassified.value);
</script>

<template>
  <div class="container py-5" style="max-width: 960px;">
    <div v-if="isLoading" class="text-center py-5">
      <BSpinner variant="primary" />
    </div>

    <div v-else-if="!activeData" class="text-center py-5">
      <i class="bi bi-x-circle fs-1 text-muted d-block mb-3"></i>
      <p class="text-muted mb-3">This listing could not be found or is no longer active.</p>
      <BButton variant="outline-primary" @click="router.push('/classified')">Browse Classifieds</BButton>
    </div>

    <div v-else>
      <!-- Back link + action buttons -->
      <div class="d-flex justify-content-between align-items-center mb-4">
        <BButton variant="outline-secondary" size="sm" to="/classified" :router-link="true">
          <i class="bi bi-arrow-left me-1"></i> All Classifieds
        </BButton>

        <!-- Owner actions -->
        <div v-if="isOwner && classified?.status === 'active'" class="d-flex gap-2">
          <BButton
            v-if="canRenew"
            variant="outline-primary"
            size="sm"
            @click="handleRenew"
            :disabled="isActing"
          >
            <BSpinner v-if="isActing" small class="me-1" />
            <i v-else class="bi bi-arrow-repeat me-1"></i>
            Renew ({{ classified!.max_renewals - classified!.renewal_count }} left)
          </BButton>
          <BButton variant="outline-danger" size="sm" @click="handleDiscard" :disabled="isActing">
            <i class="bi bi-x-circle me-1"></i> Close Listing
          </BButton>
        </div>

        <!-- Message button for non-owners -->
        <div v-else-if="isLoggedIn && !isDraft && classified?.status === 'active'" class="d-flex gap-2">
          <BButton
            variant="outline-primary"
            size="sm"
            :disabled="isOpeningThread"
            @click="publishedFarms.length > 0 ? (showMessageModal = true) : handleMessage(null)"
          >
            <BSpinner v-if="isOpeningThread" small class="me-1" />
            <i v-else class="bi bi-chat me-1"></i>
            Message {{ activeData?.display_name }}
          </BButton>
        </div>

        <!-- Admin approve/reject -->
        <div v-else-if="isAdmin && isDraft" class="d-flex gap-2">
          <BButton variant="primary" size="sm" class="px-4 fw-bold" @click="showPublishModal = true" :disabled="isActing">
            <i class="bi bi-check-circle me-1"></i> Publish Live...
          </BButton>
          <BButton variant="outline-danger" size="sm" class="fw-bold" @click="showDiscardModal = true" :disabled="isActing">
            <i class="bi bi-x-circle me-1"></i> Discard Draft...
          </BButton>
        </div>
      </div>

      <div class="card border-0 shadow-sm overflow-hidden">
        <!-- Hero header: title + badges, full width -->
        <div class="classified-detail-header p-4 text-white position-relative">
          <div class="position-relative z-1">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <BBadge bg-color="rgba(255,255,255,0.2)" text-color="white" pill class="fs-6 px-3 py-2 border border-white border-opacity-25">
                {{ CATEGORY_LABELS[activeData.category] || activeData.category }}
              </BBadge>
              <div v-if="isDraft" class="badge bg-warning text-dark px-3 py-2 shadow-sm animate-pulse">
                <i class="bi bi-file-earmark-check me-1"></i> Pending Approval
              </div>
              <BBadge v-else-if="classified?.status === 'expired'" variant="secondary" pill>Expired</BBadge>
              <BBadge v-else-if="classified?.status === 'discarded'" variant="danger" pill>Closed</BBadge>
            </div>
            <h2 class="fs-4 fw-bold text-white mb-0">{{ activeData.title }}</h2>
          </div>
        </div>

        <!-- Two-column body: description left, meta right -->
        <div class="card-body p-0">
          <div class="row g-0">
            <!-- Description (60%) -->
            <div class="col-12 col-md-7 p-4 border-end description-col">
              <p class="mb-0" style="line-height:1.8; white-space: pre-wrap;">{{ activeData.description }}</p>
            </div>

            <!-- Meta + actions (40%) -->
            <div class="col-12 col-md-5 p-4 bg-light d-flex flex-column gap-3">
              <div class="d-flex flex-column gap-2 small">
                <div class="d-flex gap-2">
                  <span class="text-muted" style="min-width:64px;">Location</span>
                  <span>{{ activeData.location }}</span>
                </div>
                <div class="d-flex gap-2">
                  <span class="text-muted" style="min-width:64px;">Posted by</span>
                  <span>{{ activeData.display_name }}<span v-if="user?.uid === activeData.owner_uid" class="text-muted"> (you)</span></span>
                </div>
                <div class="d-flex gap-2">
                  <span class="text-muted" style="min-width:64px;">Posted</span>
                  <span>{{ formatRelativeTime(activeData.created_at) }}</span>
                </div>
                <div v-if="classified?.expires_at" class="d-flex gap-2">
                  <span class="text-muted" style="min-width:64px;">Expires</span>
                  <span :class="{ 'text-danger fw-semibold': daysUntilExpiry !== null && daysUntilExpiry <= 2 }">
                    {{ formatDate(classified.expires_at) }}
                    <span v-if="daysUntilExpiry !== null && daysUntilExpiry > 0">({{ daysUntilExpiry }}d)</span>
                    <span v-else-if="daysUntilExpiry !== null && daysUntilExpiry <= 0">(today)</span>
                  </span>
                </div>
                <div v-if="classified && (isOwner || isAdmin)" class="d-flex gap-2">
                  <span class="text-muted" style="min-width:64px;">Renewals</span>
                  <span>{{ classified.renewal_count }} / {{ classified.max_renewals }} used</span>
                </div>
              </div>
              <span v-if="isOwner && !canRenew && classified && classified.renewal_count < classified.max_renewals" class="text-muted small">
                Renewal available within 2 days of expiration
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PUBLISH CONFIRMATION MODAL -->
    <BModal v-model="showPublishModal" title="Publish Classified?" @ok="handleApprove" :ok-disabled="isActing" ok-title="Publish Live" ok-variant="primary">
      <p>Are you sure you want to approve and publish this classified? It will be visible to everyone immediately.</p>
    </BModal>

    <!-- DISCARD CONFIRMATION MODAL -->
    <BModal v-model="showDiscardModal" title="Discard Draft?" @ok="handleReject" :ok-disabled="isActing" ok-title="Discard Draft" ok-variant="danger">
      <p>Are you sure you want to discard this classified? This action cannot be undone.</p>
    </BModal>

    <!-- MESSAGE AS MODAL -->
    <BModal v-model="showMessageModal" title="Message as..." hide-footer>
      <div class="d-flex flex-column gap-2">
        <BButton variant="outline-secondary" class="text-start" @click="handleMessage(null)">
          <i class="bi bi-person me-2"></i>Yourself ({{ user?.displayName }})
        </BButton>
        <BButton
          v-for="farm in publishedFarms"
          :key="farm.id"
          variant="outline-primary"
          class="text-start"
          @click="handleMessage(farm.id)"
        >
          <i class="bi bi-house me-2"></i>{{ farm.name }}
        </BButton>
      </div>
    </BModal>
  </div>
</template>

<style scoped>
@media (min-width: 768px) {
  .description-col {
    min-height: 220px;
  }
}

.classified-detail-header {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
}
.classified-detail-header::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  pointer-events: none;
}
</style>
