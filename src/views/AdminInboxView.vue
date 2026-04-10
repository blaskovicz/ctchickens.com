<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { db } from '../firebase';
import { 
  collection, getDocs, doc, deleteDoc, 
  serverTimestamp, updateDoc, getDoc,
  query, collectionGroup, where, orderBy
} from 'firebase/firestore';
import { 
  useToast, 
  BButton, BCard, BListGroup, BListGroupItem, BModal, BSpinner, BBadge
} from 'bootstrap-vue-next';

const store = useStore();
const isAdmin = computed(() => store.getters.isAdmin);
const { create } = useToast();

const claims = ref<any[]>([]);
const drafts = ref<any[]>([]);
const flaggedMessages = ref<any[]>([]);
const liveSlugs = ref<Set<string>>(new Set()); // Track which drafts are already live
const userProfiles = ref<Record<string, any>>({});
const isLoading = ref(true);

// Modal state
const showApproveModal = ref(false);
const selectedItem = ref<any>(null);
const isProcessing = ref(false);

const fetchData = async () => {
  if (!isAdmin.value) return;
  isLoading.value = true;
  try {
    const claimSnap = await getDocs(collection(db, 'claim_requests'));
    claims.value = claimSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const draftSnap = await getDocs(collection(db, 'draft_profiles'));
    drafts.value = draftSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch Flagged Messages
    const flagQ = query(
      collectionGroup(db, 'messages'),
      where('adminReviewStatus', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const flagSnap = await getDocs(flagQ);
    flaggedMessages.value = flagSnap.docs.map(d => ({ 
      id: d.id, 
      path: d.ref.path,
      ...d.data() 
    }));

    // Check which drafts exist in the live directory
    const directorySnap = await getDocs(collection(db, 'directory_members'));
    liveSlugs.value = new Set(directorySnap.docs.map(d => d.id));

    // Fetch user profiles for all requesters/owners/senders
    const uids = new Set([
      ...claims.value.map(c => c.requesterUid),
      ...drafts.value.map(d => d.account?.ownerUid || d.draft_owner_uid),
      ...flaggedMessages.value.map(m => m.senderUid)
    ].filter(uid => !!uid));

    for (const uid of uids) {
      if (!userProfiles.value[uid]) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            userProfiles.value[uid] = userDoc.data();
          }
        } catch (err) {
          console.warn(`Could not fetch profile for UID: ${uid}`, err);
        }
      }
    }
  } catch (e: any) {
    create?.({ title: 'Error', body: `Fetch error: ${e.message}`, variant: 'danger' });
  } finally {
    isLoading.value = false;
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

// FIX: Watch isAdmin so data loads on refresh when Auth completes
watch(isAdmin, (newVal) => {
  if (newVal) fetchData();
}, { immediate: true });

onMounted(() => {
  if (isAdmin.value) fetchData();
});

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
                        <code class="small text-primary">{{ claim.requesterEmail }}</code>
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
                      <small class="text-muted">
                        Sender: 
                        <strong v-if="userProfiles[msg.senderUid]">
                          {{ userProfiles[msg.senderUid].displayName }}
                        </strong>
                        <span v-else class="fst-italic">Unknown</span>
                        <span class="mx-1">•</span>
                        {{ msg.createdAt?.toDate()?.toLocaleString() }}
                      </small>
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
