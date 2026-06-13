<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { db } from '../firebase';
import {
  collection, getDocs, doc, deleteDoc,
  serverTimestamp, updateDoc, getDoc,
  query, collectionGroup, where, orderBy, writeBatch
} from 'firebase/firestore';
import { 
  useToast, 
  BButton, BCard, BListGroup, BListGroupItem, BModal, BSpinner, BBadge
} from 'bootstrap-vue-next';

const store = useStore();
const isAdmin = computed(() => store.getters.isAdmin);
const authReady = computed(() => store.getters.authReady);
const { create } = useToast();

const claims = ref<any[]>([]);
const drafts = ref<any[]>([]);
const draftClassifieds = ref<any[]>([]);
const flaggedMessages = ref<any[]>([]);
const supportThreads = ref<any[]>([]);
const liveSlugs = ref<Set<string>>(new Set()); // Track which drafts are already live
const userProfiles = ref<Record<string, any>>({});
const isFetching = ref(false);
const isLoading = computed(() => !authReady.value || isFetching.value);

// Modal state
const showApproveModal = ref(false);
const selectedItem = ref<any>(null);
const isProcessing = ref(false);

const fetchData = async () => {
  if (!isAdmin.value) return;
  isFetching.value = true;
  try {
    const [claimSnap, draftSnap, classifiedDraftSnap, supportSnap, flagSnap, directorySnap] =
      await Promise.all([
        getDocs(collection(db, 'claim_requests')),
        getDocs(collection(db, 'draft_profiles')),
        getDocs(collection(db, 'draft_classifieds')),
        getDocs(query(
          collection(db, 'inquiry_threads'),
          where('type', '==', 'support'),
          orderBy('updatedAt', 'desc')
        )),
        getDocs(query(
          collectionGroup(db, 'messages'),
          where('adminReviewStatus', '==', 'pending'),
          orderBy('createdAt', 'desc')
        )),
        getDocs(collection(db, 'directory_members')),
      ]);

    claims.value = claimSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    drafts.value = draftSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    draftClassifieds.value = classifiedDraftSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    supportThreads.value = supportSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    flaggedMessages.value = flagSnap.docs.map(d => ({ id: d.id, path: d.ref.path, ...d.data() }));
    liveSlugs.value = new Set(directorySnap.docs.map(d => d.id));

    const uids = new Set([
      ...claims.value.map(c => c.requesterUid),
      ...drafts.value.map(d => d.account?.ownerUid || d.draft_owner_uid),
      ...flaggedMessages.value.map(m => m.senderUid),
      ...flaggedMessages.value.map(m => m.flaggedByUid),
      ...supportThreads.value.map(t => t.userUid)
    ].filter((uid): uid is string => !!uid));

    await Promise.all(
      [...uids].filter(uid => !userProfiles.value[uid]).map(async uid => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) userProfiles.value[uid] = userDoc.data();
        } catch (err) {
          console.warn(`Could not fetch profile for UID: ${uid}`, err);
        }
      })
    );
  } catch (e: any) {
    create?.({ title: 'Error', body: `Fetch error: ${e.message}`, variant: 'danger' });
  } finally {
    isFetching.value = false;
  }
};

// moderation logic
const handleModeration = async (msg: any, status: 'approved' | 'hidden') => {
  try {
    const msgRef = doc(db, msg.path);
    await updateDoc(msgRef, {
      adminReviewStatus: status
    });
    create?.({ body: `Message ${status}.`, variant: 'success' });
    fetchData();
  } catch (e: any) {
    create?.({ body: `Moderation failed: ${e.message}`, variant: 'danger' });
  }
};

watch(
  [authReady, isAdmin],
  ([ready, admin]) => { if (ready && admin) fetchData(); },
  { immediate: true }
);

const confirmApprove = (claim: any) => {
  selectedItem.value = claim;
  showApproveModal.value = true;
};

const handleApprove = async () => {
  if (!selectedItem.value) return;
  isProcessing.value = true;
  
  try {
    const memberRef = doc(db, 'directory_members', selectedItem.value.businessSlug);
    await updateDoc(memberRef, {
      'account.ownerUid': selectedItem.value.requesterUid,
      'account.updatedAt': serverTimestamp()
    });

    await deleteDoc(doc(db, 'claim_requests', selectedItem.value.id));

    // Hand off any threads that were routed to 'admin' while the farm was unclaimed
    const threadsQ = query(
      collection(db, 'inquiry_threads'),
      where('breederSlug', '==', selectedItem.value.businessSlug),
      where('participants', 'array-contains', 'admin')
    );
    const threadsSnap = await getDocs(threadsQ);
    if (!threadsSnap.empty) {
      const handoffBatch = writeBatch(db);
      threadsSnap.forEach(t => {
        const tData = t.data();
        const updated = (tData.participants as string[])
          .filter(p => p !== 'admin')
          .concat(selectedItem.value.requesterUid);
        handoffBatch.update(t.ref, {
          participants: updated,
          // Carry over the admin unread count so new owner sees pending messages
          [`unreadCount.${selectedItem.value.requesterUid}`]: tData.unreadCount?.admin || 0
        });
      });
      await handoffBatch.commit();
    }

    create?.({ body: 'Claim Approved successfully!', variant: 'success' });
    showApproveModal.value = false;
    fetchData();
    store.dispatch('fetchDirectory');
  } catch (e: any) {
    create?.({ body: `Error: ${e.message}`, variant: 'danger' });
  } finally {
    isProcessing.value = false;
  }
};

const handleRejectClaim = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'claim_requests', id));
    create?.({ body: 'Claim request removed.', variant: 'info' });
    fetchData();
  } catch (e: any) {
    create?.({ body: `Error: ${e.message}`, variant: 'danger' });
  }
};

</script>

<template>
  <div class="container py-5">
    <div v-if="!isAdmin" class="alert alert-warning">Access Denied. Admin only.</div>
    
    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold text-primary">Admin Inbox</h2>
        <BButton @click="fetchData" variant="outline-primary" size="sm">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </BButton>
      </div>

      <div v-if="isLoading" class="text-center py-5">
        <BSpinner variant="primary" />
      </div>

      <div v-else class="row g-4">
        
        <!-- SECTION: Claim Requests -->
        <div class="col-lg-6">
          <BCard shadow class="border-0 h-100">
            <template #header>
              <div class="d-flex align-items-center gap-2 py-1">
                <i class="bi bi-person-badge text-primary"></i>
                <h5 class="mb-0 fw-bold">Claim Requests ({{ claims.length }})</h5>
              </div>
            </template>
            
            <BListGroup flush>
              <BListGroupItem v-if="claims.length === 0" class="text-center py-4 text-muted">
                No pending claims.
              </BListGroupItem>
              <BListGroupItem v-for="claim in claims" :key="claim.id" class="p-3">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="d-flex gap-3 align-items-center">
                    <img v-if="claim.requesterPhotoURL" :src="claim.requesterPhotoURL" width="40" height="40" class="rounded-circle shadow-sm border">
                    <div v-else class="bg-light rounded-circle border d-flex align-items-center justify-content-center shadow-sm" style="width: 40px; height: 40px;">
                      <i class="bi bi-person text-muted"></i>
                    </div>
                    <div>
                      <h6 class="mb-1 fw-bold">{{ claim.businessName }}</h6>
                      <p class="mb-0 small text-muted">By: <strong>{{ claim.requesterName }}</strong> on {{ claim.createdAt?.toDate()?.toLocaleDateString() }}</p>
                      <div class="d-flex align-items-center gap-2 mt-1">
                        <code class="small text-primary">{{
                          userProfiles[claim.requesterUid]?.localEmail ||
                          userProfiles[claim.requesterUid]?.email ||
                          claim.requesterEmail
                        }}</code>
                      </div>
                    </div>
                  </div>
                  <div class="d-flex gap-2">
                    <BButton @click="confirmApprove(claim)" variant="success" size="sm">Approve</BButton>
                    <BButton @click="handleRejectClaim(claim.id)" variant="outline-danger" size="sm"><i class="bi bi-trash"></i></BButton>
                  </div>
                </div>
              </BListGroupItem>
            </BListGroup>
          </BCard>
        </div>

        <!-- SECTION: Pending Drafts -->
        <div class="col-lg-6">
          <BCard shadow class="border-0 h-100">
            <template #header>
              <div class="d-flex align-items-center gap-2 py-1">
                <i class="bi bi-file-earmark-diff text-warning"></i>
                <h5 class="mb-0 fw-bold">Profile Drafts ({{ drafts.length }})</h5>
              </div>
            </template>
            
            <BListGroup flush>
              <BListGroupItem v-if="drafts.length === 0" class="text-center py-4 text-muted">
                No pending drafts.
              </BListGroupItem>
              <BListGroupItem v-for="draft in drafts" :key="draft.id" class="p-3">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="d-flex flex-column gap-1">
                    <div class="d-flex align-items-center gap-2">
                      <h6 class="mb-0 fw-bold">{{ draft.profile?.businessName || draft.id }}</h6>
                      <BBadge v-if="!liveSlugs.has(draft.id)" variant="success" pill style="font-size: 0.65rem;">NEW LISTING</BBadge>
                      <BBadge v-else variant="info" pill style="font-size: 0.65rem;">UPDATE</BBadge>
                    </div>
                    
                    <p class="mb-0 small text-muted">
                      Owner: 
                      <strong v-if="userProfiles[draft.account?.ownerUid || draft.draft_owner_uid]">
                        {{ userProfiles[draft.account?.ownerUid || draft.draft_owner_uid].displayName }}
                      </strong>
                      <span v-else class="fst-italic">Unknown User</span>
                      <span class="mx-1">•</span>
                      {{ (draft.account?.updatedAt || draft.updatedAt)?.toDate()?.toLocaleDateString() }}
                    </p>
                  </div>
                  <div class="d-flex gap-2">
                    <BButton :to="`/directory/${draft.id}/edit`" variant="outline-primary" size="sm">Review</BButton>
                  </div>
                </div>
              </BListGroupItem>
            </BListGroup>
          </BCard>
        </div>

        <!-- SECTION: Pending Classifieds -->
        <div class="col-lg-6">
          <BCard shadow class="border-0 h-100">
            <template #header>
              <div class="d-flex align-items-center gap-2 py-1">
                <i class="bi bi-tags-fill text-success"></i>
                <h5 class="mb-0 fw-bold">Pending Classifieds ({{ draftClassifieds.length }})</h5>
              </div>
            </template>
            <BListGroup flush>
              <BListGroupItem v-if="draftClassifieds.length === 0" class="text-center py-4 text-muted">
                No pending classifieds.
              </BListGroupItem>
              <BListGroupItem v-for="item in draftClassifieds" :key="item.id" class="p-3">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="d-flex flex-column gap-1">
                    <h6 class="mb-0 fw-bold">{{ item.title || item.category }}</h6>
                    <p class="mb-0 small text-muted">{{ item.display_name }} — {{ item.location }}</p>
                    <p class="mb-0 small text-truncate" style="max-width:220px;">{{ item.description }}</p>
                  </div>
                  <BButton :to="`/classified/${item.id}`" variant="outline-primary" size="sm">Review</BButton>
                </div>
              </BListGroupItem>
            </BListGroup>
          </BCard>
        </div>

        <!-- SECTION: Support Tickets -->
        <div class="col-lg-6">
          <BCard shadow class="border-0 h-100">
            <template #header>
              <div class="d-flex align-items-center gap-2 py-1">
                <i class="bi bi-headset text-info"></i>
                <h5 class="mb-0 fw-bold">Support Tickets ({{ supportThreads.length }})</h5>
              </div>
            </template>
            
            <BListGroup flush>
              <BListGroupItem v-if="supportThreads.length === 0" class="text-center py-4 text-muted">
                No active support tickets.
              </BListGroupItem>
              <BListGroupItem v-for="thread in supportThreads" :key="thread.id" class="p-3">
                <div class="d-flex justify-content-between align-items-center">
                  <div class="d-flex gap-3 align-items-center">
                    <img v-if="userProfiles[thread.userUid]?.photoURL" :src="userProfiles[thread.userUid].photoURL" width="40" height="40" class="rounded-circle border">
                    <div v-else class="bg-light rounded-circle border d-flex align-items-center justify-content-center shadow-sm" style="width: 40px; height: 40px;">
                      <i class="bi bi-person text-muted"></i>
                    </div>
                    <div>
                      <h6 class="mb-1 fw-bold">{{ userProfiles[thread.userUid]?.displayName || 'User' }}</h6>
                      <p class="mb-0 small text-muted text-truncate" style="max-width: 150px;">{{ thread.lastMessage }}</p>
                    </div>
                  </div>
                  <BButton :to="`/inbox/${thread.id}`" variant="primary" size="sm">Reply</BButton>
                </div>
              </BListGroupItem>
            </BListGroup>
          </BCard>
        </div>

        <!-- SECTION: Flagged Messages -->
        <div class="col-12 mt-4">
          <BCard shadow class="border-0">
            <template #header>
              <div class="d-flex align-items-center gap-2 py-1">
                <i class="bi bi-flag-fill text-danger"></i>
                <h5 class="mb-0 fw-bold">Flagged Messages ({{ flaggedMessages.length }})</h5>
              </div>
            </template>
            
            <BListGroup flush>
              <BListGroupItem v-if="flaggedMessages.length === 0" class="text-center py-4 text-muted">
                No flagged messages to review.
              </BListGroupItem>
              <BListGroupItem v-for="msg in flaggedMessages" :key="msg.id" class="p-3">
                <div class="d-flex justify-content-between align-items-center">
                  <div class="d-flex gap-3 align-items-start">
                    <div class="bg-light rounded-circle border d-flex align-items-center justify-content-center shadow-sm" style="width: 40px; height: 40px; flex-shrink: 0;">
                      <i class="bi bi-chat-dots text-muted"></i>
                    </div>
                    <div>
                      <p class="mb-1 text-dark">{{ msg.text }}</p>
                      <div class="small text-muted">
                        <span class="me-2">Sender: 
                          <strong v-if="userProfiles[msg.senderUid]">{{ userProfiles[msg.senderUid].displayName }}</strong>
                          <span v-else class="fst-italic text-muted">Unknown</span>
                        </span>
                        <span class="me-2">|</span>
                        <span>Flagged by: 
                          <strong v-if="userProfiles[msg.flaggedByUid]">{{ userProfiles[msg.flaggedByUid].displayName }}</strong>
                          <span v-else class="fst-italic text-muted">Unknown</span>
                        </span>
                        <span class="mx-2">•</span>
                        {{ msg.createdAt?.toDate()?.toLocaleString() }}
                      </div>
                    </div>
                  </div>
                  <div class="d-flex gap-2">
                    <BButton @click="handleModeration(msg, 'approved')" variant="outline-success" size="sm">Approve</BButton>
                    <BButton @click="handleModeration(msg, 'hidden')" variant="danger" size="sm">Hide</BButton>
                  </div>
                </div>
              </BListGroupItem>
            </BListGroup>
          </BCard>
        </div>

      </div>
    </div>

    <!-- MODALS -->
    <BModal v-model="showApproveModal" title="Approve Claim" @ok="handleApprove" :ok-disabled="isProcessing">
      <p v-if="selectedItem">Are you sure you want to approve the claim for <strong>{{ selectedItem.businessName }}</strong>?</p>
      <p class="small text-muted">This will give <strong>{{ selectedItem?.requesterName }}</strong> management access to this listing.</p>
      <template #footer="{ ok, cancel }">
        <BButton variant="secondary" @click="cancel()">Cancel</BButton>
        <BButton variant="success" @click="ok()" :disabled="isProcessing">
          <BSpinner v-if="isProcessing" small class="me-1" />
          Approve Claim
        </BButton>
      </template>
    </BModal>

  </div>
</template>

<style scoped>
.list-group-item {
  transition: background-color 0.2s;
}
.list-group-item:hover {
  background-color: #f8f9fa;
}
</style>