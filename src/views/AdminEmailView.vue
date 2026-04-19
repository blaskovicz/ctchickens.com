<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';
import { db, functions } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { marked } from 'marked';
import { formatDistanceToNow } from 'date-fns';
import {
  useToast,
  BButton, BCard, BFormCheckbox, BFormSelect, BFormInput,
  BFormTextarea, BSpinner, BBadge, BAlert
} from 'bootstrap-vue-next';

const store = useStore();
const isAdmin = computed(() => store.getters.isAdmin);
const { create } = useToast();

// --- Data ---
interface UserRow {
  kind: 'user';
  uid: string;
  displayName: string;
  email: string | null;
  facebookEmail: string | null;
  lastLogin: Date | null;
}

interface FarmRow {
  kind: 'farm';
  slug: string;
  businessName: string;
  contactEmail: string | null;
  ownerUid: string | null;
  isVerified: boolean;
  // resolved email (owner email or contactEmail)
  resolvedEmail: string | null;
  ownerEmail: string | null;
}

type Row = UserRow | FarmRow;

const allUsers = ref<UserRow[]>([]);
const allFarms = ref<FarmRow[]>([]);
const isLoading = ref(true);
const isSending = ref(false);

// --- Filters ---
type FilterMode = 'both' | 'users' | 'farms';
const filterMode = ref<FilterMode>('both');

// --- Selection ---
const selectedIds = ref<Set<string>>(new Set());

// --- Compose ---
type TemplateName = 'welcome' | 'claim-reminder' | 'verification-nudge' | 'announcement' | '';
const chosenTemplate = ref<TemplateName>('');
const subject = ref('');
const customBody = ref('');

const templateOptions = [
  { value: '', text: 'Select a template...' },
  { value: 'welcome', text: 'Welcome (re-send)' },
  { value: 'claim-reminder', text: 'Claim Reminder' },
  { value: 'verification-nudge', text: 'Verification Nudge' },
  { value: 'announcement', text: 'Announcement' },
];

const defaultSubjects: Record<string, string> = {
  'welcome': 'Welcome to CT Chickens!',
  'claim-reminder': 'Your farm is listed on CT Chickens — claim your profile',
  'verification-nudge': 'Get verified on CT Chickens',
  'announcement': '',
};

const showCustomBody = computed(() =>
  chosenTemplate.value === 'announcement'
);

watch(chosenTemplate, (val) => {
  if (val && defaultSubjects[val] !== undefined) {
    subject.value = defaultSubjects[val];
  }
});

// --- Displayed rows ---
const displayedRows = computed<Row[]>(() => {
  const rows: Row[] = [];
  if (filterMode.value === 'users' || filterMode.value === 'both') {
    rows.push(...allUsers.value);
  }
  if (filterMode.value === 'farms' || filterMode.value === 'both') {
    rows.push(...allFarms.value);
  }
  return rows;
});

function rowId(row: Row): string {
  return row.kind === 'user' ? `user:${row.uid}` : `farm:${row.slug}`;
}

function rowEmail(row: Row): string | null {
  return row.kind === 'user' ? row.email : row.resolvedEmail;
}

// --- Select all / none ---
const allDisplayedSelected = computed(() => {
  return displayedRows.value.length > 0 &&
    displayedRows.value.every(r => selectedIds.value.has(rowId(r)));
});

function toggleSelectAll() {
  if (allDisplayedSelected.value) {
    displayedRows.value.forEach(r => selectedIds.value.delete(rowId(r)));
  } else {
    displayedRows.value.forEach(r => selectedIds.value.add(rowId(r)));
  }
  // Trigger reactivity
  selectedIds.value = new Set(selectedIds.value);
}

function toggleRow(row: Row) {
  const id = rowId(row);
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
  selectedIds.value = new Set(selectedIds.value);
}

const selectedCount = computed(() => selectedIds.value.size);

// --- Mismatch warning ---
const mismatchWarning = computed<string | null>(() => {
  if (!chosenTemplate.value || selectedCount.value === 0) return null;

  if (chosenTemplate.value === 'claim-reminder') {
    const selectedFarms = allFarms.value.filter(f => selectedIds.value.has(`farm:${f.slug}`));
    const claimedCount = selectedFarms.filter(f => f.ownerUid).length;
    if (claimedCount > 0) {
      return `Claim Reminder selected, but ${claimedCount} selected farm(s) already have an owner.`;
    }
  }

  if (chosenTemplate.value === 'verification-nudge') {
    const selectedFarms = allFarms.value.filter(f => selectedIds.value.has(`farm:${f.slug}`));
    const verifiedCount = selectedFarms.filter(f => f.isVerified).length;
    if (verifiedCount > 0) {
      return `Verification Nudge selected, but ${verifiedCount} selected farm(s) are already verified.`;
    }
  }

  if (chosenTemplate.value === 'welcome') {
    const selectedFarms = allFarms.value.filter(f => selectedIds.value.has(`farm:${f.slug}`));
    if (selectedFarms.length > 0) {
      return `Welcome template selected, but ${selectedFarms.length} farm(s) are selected. Welcome emails are typically for users.`;
    }
  }

  return null;
});

// --- Send disabled ---
const sendDisabled = computed(() => {
  if (selectedCount.value === 0 || !chosenTemplate.value || !subject.value.trim()) return true;
  if (isSending.value) return true;
  return false;
});

// --- Data loading ---
const fetchData = async () => {
  if (!isAdmin.value) return;
  isLoading.value = true;

  try {
    // Fetch all users
    const usersSnap = await getDocs(collection(db, 'users'));
    const usersMap: Record<string, { email: string | null; displayName: string }> = {};
    allUsers.value = usersSnap.docs.map(d => {
      const data = d.data();
      const effectiveEmail = (data.localEmail as string) || (data.email as string) || null;
      usersMap[d.id] = {
        email: effectiveEmail,
        displayName: (data.displayName as string) || d.id,
      };
      return {
        kind: 'user' as const,
        uid: d.id,
        displayName: (data.displayName as string) || d.id,
        email: effectiveEmail,
        facebookEmail: (data.email as string) || null,
        lastLogin: data.lastLogin?.toDate?.() ?? null,
      };
    });

    // Fetch all farms
    const farmsSnap = await getDocs(collection(db, 'directory_members'));
    allFarms.value = farmsSnap.docs.map(d => {
      const data = d.data();
      const ownerUid = (data.account?.ownerUid as string) || null;
      const contactEmail = (data.profile?.contactEmail as string) || null;
      let ownerEmail: string | null = null;
      if (ownerUid && usersMap[ownerUid]) {
        ownerEmail = usersMap[ownerUid].email;
      }
      const resolvedEmail = ownerEmail || contactEmail;
      return {
        kind: 'farm' as const,
        slug: d.id,
        businessName: (data.profile?.businessName as string) || d.id,
        contactEmail,
        ownerUid,
        isVerified: data.account?.isVerified === true,
        resolvedEmail,
        ownerEmail,
      };
    });
  } catch (e: any) {
    create?.({ title: 'Error', body: `Failed to load data: ${e.message}`, variant: 'danger' });
  } finally {
    isLoading.value = false;
  }
};

watch(isAdmin, (val) => { if (val) fetchData(); }, { immediate: true });
onMounted(() => { if (isAdmin.value) fetchData(); });

// --- Send ---
const handleSend = async () => {
  if (sendDisabled.value) return;
  isSending.value = true;

  try {
    // Build recipients list
    const recipients: Array<{ type: 'user'; uid: string } | { type: 'farm'; slug: string }> = [];
    for (const id of selectedIds.value) {
      if (id.startsWith('user:')) {
        recipients.push({ type: 'user', uid: id.slice(5) });
      } else if (id.startsWith('farm:')) {
        recipients.push({ type: 'farm', slug: id.slice(5) });
      }
    }

    // Render markdown to HTML if needed
    let customBodyHtml: string | undefined;
    if (showCustomBody.value && customBody.value.trim()) {
      customBodyHtml = await marked(customBody.value);
    }

    const adminSendEmail = httpsCallable<
      {
        recipients: typeof recipients;
        template: string;
        subject: string;
        customBodyHtml?: string;
      },
      { sent: number; skipped: number }
    >(functions, 'adminSendEmail');

    const result = await adminSendEmail({
      recipients,
      template: chosenTemplate.value as string,
      subject: subject.value,
      customBodyHtml,
    });

    const { sent, skipped } = result.data;
    create?.({
      title: 'Emails sent',
      body: `Sent ${sent}, skipped ${skipped}`,
      variant: 'success',
    });

    // Clear selection after send
    selectedIds.value = new Set();
  } catch (e: any) {
    create?.({ title: 'Send failed', body: e.message, variant: 'danger' });
  } finally {
    isSending.value = false;
  }
};

</script>

<template>
  <div class="container-fluid py-4 px-4">
    <div v-if="!isAdmin" class="alert alert-warning">Access Denied. Admin only.</div>

    <div v-else>
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold text-primary">Admin Email Center</h2>
        <BButton @click="fetchData" variant="outline-primary" size="sm" :disabled="isLoading">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </BButton>
      </div>

      <div v-if="isLoading" class="text-center py-5">
        <BSpinner variant="primary" />
      </div>

      <div v-else class="row g-4">

        <!-- LEFT: Recipient list -->
        <div class="col-lg-7">
          <BCard class="border-0 shadow-sm h-100">
            <template #header>
              <div class="d-flex align-items-center justify-content-between py-1 flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-people text-primary"></i>
                  <h5 class="mb-0 fw-bold">Recipients</h5>
                  <BBadge variant="secondary" pill>{{ selectedCount }} selected</BBadge>
                </div>
                <!-- Filter toggles -->
                <div class="btn-group btn-group-sm" role="group">
                  <button
                    type="button"
                    class="btn"
                    :class="filterMode === 'both' ? 'btn-primary' : 'btn-outline-primary'"
                    @click="filterMode = 'both'"
                  >All</button>
                  <button
                    type="button"
                    class="btn"
                    :class="filterMode === 'users' ? 'btn-primary' : 'btn-outline-primary'"
                    @click="filterMode = 'users'"
                  >Users</button>
                  <button
                    type="button"
                    class="btn"
                    :class="filterMode === 'farms' ? 'btn-primary' : 'btn-outline-primary'"
                    @click="filterMode = 'farms'"
                  >Farms</button>
                </div>
              </div>
            </template>

            <!-- Select all bar -->
            <div class="d-flex align-items-center gap-3 px-1 pb-2 border-bottom">
              <BFormCheckbox
                :modelValue="allDisplayedSelected"
                @update:modelValue="toggleSelectAll"
                :indeterminate="selectedCount > 0 && !allDisplayedSelected"
              >
                <span class="small text-muted">Select all ({{ displayedRows.length }})</span>
              </BFormCheckbox>
            </div>

            <!-- Rows -->
            <div class="recipient-list">
              <div
                v-if="displayedRows.length === 0"
                class="text-center py-4 text-muted"
              >
                No recipients to show.
              </div>

              <div
                v-for="row in displayedRows"
                :key="rowId(row)"
                class="recipient-row d-flex align-items-center gap-3 py-2 px-1 border-bottom"
                :class="{ 'row-selected': selectedIds.has(rowId(row)) }"
                @click="toggleRow(row)"
                style="cursor: pointer;"
              >
                <BFormCheckbox
                  :modelValue="selectedIds.has(rowId(row))"
                  @update:modelValue="toggleRow(row)"
                  @click.stop
                />

                <!-- Icon -->
                <div class="flex-shrink-0">
                  <i v-if="row.kind === 'user'" class="bi bi-person-circle text-secondary fs-5"></i>
                  <i v-else class="bi bi-house-door text-warning fs-5"></i>
                </div>

                <!-- Name / email -->
                <div class="flex-grow-1 min-w-0">
                  <div class="fw-semibold text-truncate small">
                    {{ row.kind === 'user' ? row.displayName : row.businessName }}
                  </div>
                  <div class="text-truncate" style="font-size: 0.78rem;">
                    <template v-if="row.kind === 'user' && (row as UserRow).facebookEmail && (row as UserRow).facebookEmail !== (row as UserRow).email">
                      <span class="text-muted text-decoration-line-through">{{ (row as UserRow).facebookEmail }}</span>
                      <span class="text-muted mx-1">→</span>
                      <span class="text-success">{{ (row as UserRow).email }}</span>
                    </template>
                    <span v-else-if="rowEmail(row)" class="text-muted">{{ rowEmail(row) }}</span>
                    <BBadge v-else variant="danger" style="font-size: 0.65rem;">no email</BBadge>
                  </div>
                  <div v-if="row.kind === 'user' && (row as UserRow).lastLogin" class="text-muted" style="font-size: 0.72rem;">
                    {{ formatDistanceToNow((row as UserRow).lastLogin!, { addSuffix: true }) }}
                  </div>
                </div>

                <!-- Status badges -->
                <div class="flex-shrink-0 d-flex flex-column gap-1 align-items-end">
                  <template v-if="row.kind === 'farm'">
                    <!-- Claim status -->
                    <span v-if="!(row as FarmRow).ownerUid" class="badge rounded-pill bg-secondary text-white" style="font-size: 0.7rem;">
                      <i class="bi bi-person-slash me-1"></i>Unclaimed
                    </span>
                    <span v-else class="badge rounded-pill bg-primary text-white" style="font-size: 0.7rem;">
                      <i class="bi bi-person-check me-1"></i>Claimed
                    </span>
                    <!-- Verification status -->
                    <span v-if="(row as FarmRow).isVerified" class="badge rounded-pill bg-success text-white" style="font-size: 0.7rem;">
                      <i class="bi bi-patch-check-fill me-1"></i>Verified
                    </span>
                    <span v-else class="badge rounded-pill bg-warning text-dark" style="font-size: 0.7rem;">
                      <i class="bi bi-patch-exclamation me-1"></i>Unverified
                    </span>
                  </template>
                  <span v-else class="badge rounded-pill bg-secondary text-white" style="font-size: 0.7rem;">User</span>
                </div>
              </div>
            </div>

          </BCard>
        </div>

        <!-- RIGHT: Compose -->
        <div class="col-lg-5">
          <BCard class="border-0 shadow-sm">
            <template #header>
              <div class="d-flex align-items-center gap-2 py-1">
                <i class="bi bi-envelope text-primary"></i>
                <h5 class="mb-0 fw-bold">Compose</h5>
              </div>
            </template>

            <div class="d-flex flex-column gap-3">
              <!-- Template picker -->
              <div>
                <label class="form-label small fw-semibold">Template</label>
                <BFormSelect
                  v-model="chosenTemplate"
                  :options="templateOptions"
                />
              </div>

              <!-- Subject -->
              <div>
                <label class="form-label small fw-semibold">Subject</label>
                <BFormInput
                  v-model="subject"
                  placeholder="Email subject line"
                />
              </div>

              <!-- Custom body (Announcement only) -->
              <div v-if="showCustomBody">
                <label class="form-label small fw-semibold">
                  Email body <span class="text-muted fw-normal">(Markdown supported)</span>
                </label>
                <BFormTextarea
                  v-model="customBody"
                  rows="8"
                  placeholder="Write your announcement here..."
                />
              </div>

              <!-- Mismatch warning -->
              <BAlert
                v-if="mismatchWarning"
                variant="warning"
                :model-value="true"
                class="mb-0 py-2 small"
              >
                <i class="bi bi-exclamation-triangle me-1"></i>
                {{ mismatchWarning }}
              </BAlert>

              <!-- Send button -->
              <div class="pt-1">
                <BButton
                  variant="primary"
                  class="w-100"
                  :disabled="sendDisabled"
                  @click="handleSend"
                >
                  <BSpinner v-if="isSending" small class="me-2" />
                  <i v-else class="bi bi-send me-2"></i>
                  Send to {{ selectedCount }} recipient{{ selectedCount === 1 ? '' : 's' }}
                </BButton>
              </div>

              <!-- Summary counts -->
              <div class="text-muted small text-center border-top pt-2">
                <span class="me-3">
                  <i class="bi bi-person me-1"></i>{{ allUsers.length }} users
                </span>
                <span>
                  <i class="bi bi-house me-1"></i>{{ allFarms.length }} farms
                </span>
              </div>
            </div>
          </BCard>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.recipient-list {
  max-height: 65vh;
  overflow-y: auto;
}
.recipient-row:hover {
  background-color: #f8f9fa;
}
.row-selected {
  background-color: #eff6ff;
}
.min-w-0 {
  min-width: 0;
}
</style>
