<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { formatRelativeTime } from '../composables/useBreederUtils';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { useSupport } from '../composables/useSupport';
import { db } from '../firebase';
import {
  doc, getDoc, addDoc, collection, serverTimestamp, writeBatch, onSnapshot, query, where, getDocs, deleteDoc
} from 'firebase/firestore';
import { storage } from '../firebase';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { BButton, BBadge, BSpinner, BModal, useToast } from 'bootstrap-vue-next';
import type { Classified, DraftClassified } from '../types';
import { TIER_LIMITS, CATEGORY_LABELS } from '../types';
import { CLASSIFIED_RENEWAL_WINDOW_DAYS, CLASSIFIED_CLEANUP_AFTER_DAYS } from '../shared-config';
import VerifiedBadge from '../components/VerifiedBadge.vue';
import FoundingBreederBadge from '../components/FoundingBreederBadge.vue';

const route = useRoute();
const router = useRouter();
const store = useStore();
const { create } = useToast();
const { contactSupport } = useSupport();

const docId = route.params.docId as string;

const classified = ref<Classified | null>(null);
const draftClassified = ref<DraftClassified | null>(null);
const ownerActiveCount = ref(0);
const isLoading = ref(true);
const isActing = ref(false);
const showPublishModal = ref(false);
const showDiscardModal = ref(false);
const showArchiveModal = ref(false);
const showDeleteDraftModal = ref(false);
const showMessageModal = ref(false);
const isOpeningThread = ref(false);
let unsubscribeClassified: (() => void) | null = null;

const user = computed(() => store.state.user);
const isAdmin = computed(() => store.getters.isAdmin);
const isLoggedIn = computed(() => store.getters.isLoggedIn);
const isOwner = computed(() => !!user.value && (classified.value?.owner_uid === user.value.uid || draftClassified.value?.owner_uid === user.value.uid));
const isDraft = computed(() => !!draftClassified.value && !classified.value);
const publishedFarms = computed(() => (store.getters.myBreeders as any[]).filter((b: any) => b.status === 'published'));

// Get all farms owned by this seller from the store
const ownerFarms = computed(() => {
  const uid = classified.value?.owner_uid || draftClassified.value?.owner_uid;
  if (!uid) return [];
  return (store.state.breeders as any[] || []).filter(b => b.ownerUid === uid);
});

// Determine tier based on farm verification
const ownerTier = computed(() => {
  const hasVerified = ownerFarms.value.some(f => f.verified);
  return hasVerified ? 'premium' : 'freemium';
});

const daysUntilExpiry = computed(() => {
  if (!classified.value?.expires_at) return null;
  const d = classified.value.expires_at.toDate ? classified.value.expires_at.toDate() : new Date(classified.value.expires_at);
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
});

const deletesAt = computed(() => {
  if (!classified.value?.expires_at) return null;
  const d = classified.value.expires_at.toDate ? classified.value.expires_at.toDate() : new Date(classified.value.expires_at);
  return new Date(d.getTime() + CLASSIFIED_CLEANUP_AFTER_DAYS * 24 * 60 * 60 * 1000);
});

const daysUntilDeletion = computed(() => {
  if (!deletesAt.value) return null;
  return Math.ceil((deletesAt.value.getTime() - Date.now()) / 86400000);
});

const canRenew = computed(() => {
  if (!classified.value || (!isOwner.value && !isAdmin.value)) return false;
  if (classified.value.status !== 'active') return false;
  if (classified.value.renewal_count >= classified.value.max_renewals) return false;
  const days = daysUntilExpiry.value;
  return days !== null && days <= CLASSIFIED_RENEWAL_WINDOW_DAYS;
});

const formatDate = (ts: any) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const fetchAdminInsights = async (ownerUid: string) => {
  if (!isAdmin.value) return;
  try {
    const liveQ = query(collection(db, 'classifieds'), where('owner_uid', '==', ownerUid), where('status', '==', 'active'));
    const draftQ = query(collection(db, 'draft_classifieds'), where('owner_uid', '==', ownerUid), where('status', '==', 'pending'));
    const [liveSnap, draftSnap] = await Promise.all([getDocs(liveQ), getDocs(draftQ)]);
    ownerActiveCount.value = liveSnap.size + draftSnap.size;
  } catch (e) {
    console.warn('Failed to fetch admin insights:', e);
  }
};

// On cold refresh the snapshot fires before auth settles, so isAdmin is false and
// fetchAdminInsights returns early. Re-run it once auth catches up.
watch(isAdmin, (nowAdmin) => {
  if (!nowAdmin) return;
  const uid = classified.value?.owner_uid ?? draftClassified.value?.owner_uid;
  if (uid) fetchAdminInsights(uid);
});

onMounted(async () => {
  try {
    // Attach a real-time listener on the classifieds doc
    unsubscribeClassified = onSnapshot(
      doc(db, 'classifieds', docId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'active' || store.getters.isAdmin || data.owner_uid === user.value?.uid) {
            classified.value = { id: snap.id, ...data } as Classified;
            fetchAdminInsights(data.owner_uid);
          }
        }
        isLoading.value = false;
      },
      (e: any) => {
        create?.({ body: `Failed to load listing: ${e.message}`, variant: 'danger' });
        isLoading.value = false;
      },
    );

    // If no live doc exists, fall back to draft lookup
    const liveSnap = await getDoc(doc(db, 'classifieds', docId));
    if (!liveSnap.exists() && user.value) {
      const draftSnap = await getDoc(doc(db, 'draft_classifieds', docId));
      if (draftSnap.exists()) {
        const data = draftSnap.data();
        if (isAdmin.value || data.owner_uid === user.value.uid) {
          draftClassified.value = { id: draftSnap.id, ...data } as DraftClassified;
          fetchAdminInsights(data.owner_uid);
        }
      }
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

const isCloning = ref(false);

const handleClone = async () => {
  if (!isOwner.value || isCloning.value) return;
  isCloning.value = true;
  try {
    const newId = await store.dispatch('cloneExpiredClassified', docId);
    create?.({ body: 'Listing reposted — it\'s live now.', variant: 'success' });
    router.push(`/classified/${newId}`);
  } catch (e: any) {
    create?.({ body: e?.message || 'Failed to clone listing.', variant: 'danger' });
  } finally {
    isCloning.value = false;
  }
};

const handleRenew = async () => {
  if (!canRenew.value || isActing.value) return;
  isActing.value = true;
  try {
    await addDoc(collection(db, 'classifieds', docId, 'actions'), {
      action: 'renew',
      owner_uid: user.value!.uid,
      created_at: serverTimestamp(),
    });
    // Optimistically increment renewal_count so canRenew flips false immediately,
    // preventing double-submits while the Cloud Function processes the action.
    if (classified.value) classified.value = { ...classified.value, renewal_count: classified.value.renewal_count + 1 };
    create?.({ body: 'Renewal requested — your listing will update shortly.', variant: 'info' });
  } catch (e: any) {
    create?.({ body: `Renewal failed: ${e.message}`, variant: 'danger' });
  } finally {
    isActing.value = false;
  }
};

const handleDiscard = async () => {
  if ((!isOwner.value && !isAdmin.value) || isActing.value || !classified.value) return;
  isActing.value = true;
  try {
    await addDoc(collection(db, 'classifieds', docId, 'actions'), {
      action: 'discard',
      owner_uid: user.value!.uid,
      created_at: serverTimestamp(),
    });
    classified.value = { ...classified.value!, status: 'discarded' };
    store.commit('SET_CLASSIFIEDS', store.state.classifieds.filter((c: Classified) => c.id !== docId));
    create?.({
      body: isAdmin.value && !isOwner.value ? 'Listing archived.' : 'Listing closed.',
      variant: 'info'
    });
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

    // Wait for the CF to write to classifieds before navigating so the list is fresh
    try {
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const snap = await getDoc(doc(db, 'classifieds', docId));
        if (snap.exists()) break;
      }
    } catch {
      // Poll failed — navigate anyway, approval already committed
    }

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

const handleDeleteDraft = async () => {
  if (!isDraft.value || !isOwner.value || isActing.value || !draftClassified.value) return;
  isActing.value = true;
  try {
    const imageUrl = draftClassified.value.image_url;
    if (imageUrl) {
      try {
        const url = new URL(imageUrl);
        const pathEncoded = url.pathname.split('/o/')[1]?.split('?')[0];
        if (pathEncoded) {
          const path = decodeURIComponent(pathEncoded);
          await deleteObject(storageRef(storage, path));
        }
      } catch {
        // Storage deletion is best-effort; proceed with doc deletion regardless
      }
    }
    await deleteDoc(doc(db, 'draft_classifieds', docId));
    create?.({ body: 'Draft deleted.', variant: 'info' });
    router.push('/classified');
  } catch (e: any) {
    create?.({ body: `Failed to delete draft: ${e.message}`, variant: 'danger' });
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

        <!-- Owner or Admin actions -->
        <div v-if="(isOwner || isAdmin) && classified?.status === 'active'" class="d-flex gap-2">
          <BButton
            v-if="isOwner && canRenew"
            variant="outline-primary"
            size="sm"
            @click="handleRenew"
            :disabled="isActing"
          >
            <BSpinner v-if="isActing" small class="me-1" />
            <i v-else class="bi bi-arrow-repeat me-1"></i>
            Renew ({{ classified!.max_renewals - classified!.renewal_count }} left)
          </BButton>
          <BButton variant="outline-danger" size="sm" @click="showArchiveModal = true" :disabled="isActing">
            <i class="bi bi-x-circle me-1"></i>
            {{ isAdmin && !isOwner ? 'Archive Listing...' : 'Close Listing...' }}
          </BButton>
        </div>

        <!-- Owner: clone or view repost of expired listing -->
        <div v-else-if="isOwner && classified?.status === 'expired'" class="d-flex gap-2 align-items-center">
          <router-link
            v-if="classified.cloned_to"
            :to="`/classified/${classified.cloned_to}`"
            class="btn btn-sm btn-outline-success"
          >
            <i class="bi bi-box-arrow-up-right me-1"></i> View Repost
          </router-link>
          <BButton
            v-else
            variant="outline-primary"
            size="sm"
            @click="handleClone"
            :disabled="isCloning"
          >
            <BSpinner v-if="isCloning" small class="me-1" />
            <i v-else class="bi bi-clipboard-plus me-1"></i>
            Clone Listing
          </BButton>
        </div>

        <!-- Owner: delete own pending draft -->
        <div v-else-if="isDraft && isOwner && !isAdmin">
          <BButton variant="outline-danger" size="sm" @click="showDeleteDraftModal = true" :disabled="isActing">
            <i class="bi bi-trash me-1"></i> Delete Draft
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
              <div class="d-flex gap-2 align-items-center">
                <span v-if="activeData.price" class="fs-5 fw-bold text-white shadow-sm">{{ activeData.price }}</span>
                <div v-if="isDraft" class="badge bg-warning text-dark px-3 py-2 shadow-sm animate-pulse">
                  <i class="bi bi-file-earmark-check me-1"></i> Pending Approval
                </div>
                <BBadge v-else-if="classified?.status === 'expired'" variant="secondary" pill class="px-3 py-2">Expired</BBadge>
                <BBadge v-else-if="classified?.status === 'discarded'" variant="danger" pill class="px-3 py-2">Closed</BBadge>
              </div>
            </div>
            <h2 class="fs-4 fw-bold text-white mb-0">{{ activeData.title }}</h2>
          </div>
        </div>

        <!-- Two-column body: description left, meta right -->
        <div class="card-body p-0">
          <div class="row g-0">
            <!-- Description (60%) -->
            <div class="col-12 col-md-7 p-4 border-end description-col">
              <div v-if="activeData.image_url" class="mb-4 text-center bg-light rounded p-2 border">
                <img :src="activeData.image_url" class="img-fluid rounded shadow-sm" style="max-height: 500px;" alt="Classified photo" />
              </div>
              <p v-if="activeData.description" class="mb-0" style="line-height:1.8; white-space: pre-wrap;">{{ activeData.description }}</p>
              <p v-else class="mb-0 text-muted fst-italic" style="line-height:1.8;">Inquire for more info</p>
            </div>

            <!-- Meta + actions (40%) -->
            <div class="col-12 col-md-5 p-4 bg-light d-flex flex-column gap-3 justify-content-center">
              <div class="d-flex flex-column gap-3 small">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-geo-alt text-muted"></i>
                  <span class="text-muted" style="min-width:75px;">Location</span>
                  <span class="text-dark">{{ activeData.location }}</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-person text-muted"></i>
                  <span class="text-muted" style="min-width:75px;">Posted by</span>
                  <span class="text-dark">{{ activeData.display_name }}<span v-if="user?.uid === activeData.owner_uid" class="text-muted"> (you)</span></span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-clock text-muted"></i>
                  <span class="text-muted" style="min-width:75px;">Posted</span>
                  <span class="text-dark">{{ formatRelativeTime(activeData.created_at) }}</span>
                </div>
                <div v-if="classified?.expires_at" class="d-flex align-items-center gap-2">
                  <i class="bi bi-calendar-event text-muted"></i>
                  <span class="text-muted" style="min-width:75px;">Expires</span>
                  <span :class="{ 'text-danger fw-semibold': daysUntilExpiry !== null && daysUntilExpiry <= CLASSIFIED_RENEWAL_WINDOW_DAYS }" class="text-dark">
                    {{ formatDate(classified.expires_at) }}
                    <span v-if="daysUntilExpiry !== null && daysUntilExpiry > 0" class="small opacity-75">({{ daysUntilExpiry }}d)</span>
                    <span v-else-if="daysUntilExpiry !== null && daysUntilExpiry <= 0" class="small opacity-75">(today)</span>
                  </span>
                </div>
                <div v-if="classified && (isOwner || isAdmin)" class="d-flex align-items-center gap-2">
                  <i class="bi bi-arrow-repeat text-muted"></i>
                  <span class="text-muted" style="min-width:75px;">Renewals</span>
                  <span class="text-dark">{{ classified.renewal_count }} / {{ classified.max_renewals }} used</span>
                </div>
              </div>
              <span v-if="(isOwner || isAdmin) && !canRenew && classified && classified.renewal_count < classified.max_renewals" class="text-muted smaller mt-2">
                <i class="bi bi-info-circle me-1"></i>Renewal available within {{ CLASSIFIED_RENEWAL_WINDOW_DAYS }} days of expiration
              </span>
              <div v-if="isOwner && (classified?.status === 'expired' || classified?.status === 'discarded')" class="alert alert-danger border-0 shadow-sm small mb-0 mt-2 d-flex align-items-start gap-2">
                <i class="bi bi-exclamation-triangle fs-5 flex-shrink-0"></i>
                <div>
                  <p class="mb-1 fw-bold">{{ classified?.status === 'expired' ? 'This listing has expired' : 'This listing has been closed' }}</p>
                  <p class="mb-0">
                    Will be permanently deleted on {{ deletesAt ? formatDate(deletesAt) : '—' }}
                    <template v-if="daysUntilDeletion !== null && daysUntilDeletion > 0"> ({{ daysUntilDeletion }}d left)</template>
                    <template v-else-if="daysUntilDeletion !== null && daysUntilDeletion <= 0"> (today)</template>.
                    <template v-if="classified?.status === 'expired' && !classified.cloned_to"> Clone it to repost instantly.</template>
                  </p>
                </div>
              </div>

              <div v-if="(isOwner || isAdmin) && activeData && ownerTier === 'freemium'" class="alert alert-warning border-0 shadow-sm small mb-0 mt-2 d-flex align-items-start gap-2">
                <i class="bi bi-stars fs-5 flex-shrink-0"></i>
                <div>
                  <p class="mb-1 fw-bold">Get more out of your listings</p>
                  <p class="mb-1">Get verified to unlock up to 10 active posts and more renewals per listing.</p>
                  <button class="btn btn-sm btn-warning fw-semibold" @click="contactSupport">Contact support to get verified</button>
                </div>
              </div>

              <!-- Admin context section -->
              <div v-if="isAdmin" class="mt-4 pt-4 border-top">
                <h6 class="text-uppercase small fw-bold text-danger mb-3 letter-spacing-1">
                  <i class="bi bi-shield-lock me-1"></i> Admin: User Insights
                </h6>
                <div class="bg-white border rounded p-3 shadow-sm d-flex flex-column gap-2 small">
                  <div class="d-flex justify-content-between border-bottom pb-2 mb-1">
                    <span class="text-muted">Tier</span>
                    <BBadge :variant="ownerTier === 'premium' ? 'success' : 'secondary'" pill>
                      {{ ownerTier.toUpperCase() }}
                    </BBadge>
                  </div>
                  <div class="d-flex justify-content-between">
                    <span class="text-muted">Active Posts</span>
                    <span :class="ownerActiveCount >= TIER_LIMITS[ownerTier] ? 'text-danger fw-bold' : 'text-dark'">
                      {{ ownerActiveCount }} / {{ TIER_LIMITS[ownerTier] }}
                    </span>
                  </div>
                  <div v-if="ownerActiveCount >= TIER_LIMITS[ownerTier]" class="text-danger smaller mt-1">
                    <i class="bi bi-exclamation-circle me-1"></i> User has reached their limit
                  </div>
                </div>
              </div>

              <!-- No farm nudge -->
              <div v-if="(isOwner || isAdmin) && ownerFarms.length === 0" class="alert alert-light border shadow-sm small mb-0 mt-2 d-flex align-items-start gap-2">
                <i class="bi bi-house-door fs-5 flex-shrink-0 text-muted"></i>
                <div>
                  <p class="mb-1 fw-bold">Buyers can't find you outside this listing</p>
                  <p class="mb-1">Create a free farm profile to get listed in the directory and start building your reputation.</p>
                  <router-link to="/get-listed" class="btn btn-sm btn-outline-primary fw-semibold">Create a farm profile</router-link>
                </div>
              </div>

              <!-- About the Seller section -->
              <div v-if="ownerFarms.length > 0" class="mt-4 pt-4 border-top">
                <h6 class="text-uppercase small fw-bold text-muted mb-3 letter-spacing-1">About the Seller</h6>
                <div v-for="farm in ownerFarms" :key="farm.id" class="d-flex flex-column gap-2 mb-3">
                  <router-link :to="`/directory/${farm.id}`" class="text-decoration-none fw-bold text-primary d-flex align-items-center gap-2">
                    <i class="bi bi-house-door"></i>
                    {{ farm.name }}
                  </router-link>
                  <div class="d-flex flex-wrap gap-2">
                    <VerifiedBadge :verified="farm.verified" />
                    <FoundingBreederBadge :count="farm.founding_breeder" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Card footer: message button for non-owners on active listings -->
        <div v-if="!isOwner && !isDraft && classified?.status === 'active'" class="card-footer bg-white border-top px-4 py-4 d-flex justify-content-end">
          <BButton
            variant="primary"
            class="px-5 shadow-sm"
            :disabled="isOpeningThread"
            @click="isLoggedIn ? (publishedFarms.length > 0 ? (showMessageModal = true) : handleMessage(null)) : store.dispatch('loginWithFacebook')"
          >
            <BSpinner v-if="isOpeningThread" small class="me-1" />
            <i v-else class="bi bi-chat-dots-fill me-1"></i>
            <template v-if="isLoggedIn">Message</template>
            <template v-else>Log in to Send a Message</template>
          </BButton>
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

    <!-- ARCHIVE/CLOSE CONFIRMATION MODAL -->
    <BModal
      v-model="showArchiveModal"
      :title="isAdmin && !isOwner ? 'Archive Listing?' : 'Close Listing?'"
      @ok="handleDiscard"
      :ok-disabled="isActing"
      :ok-title="isAdmin && !isOwner ? 'Archive Listing' : 'Close Listing'"
      ok-variant="danger"
    >
      <p v-if="isAdmin && !isOwner">Are you sure you want to archive this listing? It will be removed from the public directory immediately.</p>
      <p v-else>Are you sure you want to close this listing? It will no longer be visible to others.</p>
      <p v-if="!isAdmin && classified?.cloned_from" class="mb-0 text-danger small">
        <i class="bi bi-exclamation-triangle me-1"></i>This listing was cloned from an expired post. Closing it cannot be undone — you won't be able to clone the original again.
      </p>
    </BModal>

    <!-- DELETE DRAFT CONFIRMATION MODAL -->
    <BModal v-model="showDeleteDraftModal" title="Delete Draft?" @ok="handleDeleteDraft" :ok-disabled="isActing" ok-title="Delete Draft" ok-variant="danger">
      <p>Are you sure you want to delete this draft? This cannot be undone.</p>
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
