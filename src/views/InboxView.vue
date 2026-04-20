<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import { db, trackEvent } from '../firebase';
import { 
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, runTransaction, getDoc,
  writeBatch, or
} from 'firebase/firestore';
import { 
  BContainer, BRow, BCol, BListGroup, BListGroupItem, 
  BFormTextarea, BButton, BSpinner, BBadge, useToast, BAlert
} from 'bootstrap-vue-next';
import { useBreederUtils } from '../composables/useBreederUtils';
import { useSupport } from '../composables/useSupport';
import type { InquiryThread, InquiryMessage } from '../types';

const store = useStore();
const route = useRoute();
const router = useRouter();
const { create } = useToast();
const { formatDisplayName } = useBreederUtils();
const { contactSupport } = useSupport();

const user = computed(() => store.state.user);
const isAdmin = computed(() => store.getters.isAdmin);
const ownedSlugs = computed(() => store.getters.ownedSlugs);

const threads = ref<InquiryThread[]>([]);
const messages = ref<InquiryMessage[]>([]);
const activeThreadId = ref<string | null>((route.params.threadId as string) || null);
const activeThread = computed(() => threads.value.find(t => t.id === activeThreadId.value));
const isPendingSupportThread = computed(() => activeThreadId.value === 'support_new');

// undefined = still resolving, null = confirmed unclaimed, string = has owner
const activeBreederOwnerUid = ref<string | null | undefined>(undefined);

const isUnclaimed = computed(() => {
  if (!activeThread.value || activeThread.value.type === 'support') return false;
  if (activeThread.value.userUid !== user.value?.uid) return false;
  if (activeBreederOwnerUid.value === undefined) return false; // loading — don't flash
  return activeBreederOwnerUid.value === null;
});

const fetchBreederStatus = async (slug: string) => {
  activeBreederOwnerUid.value = undefined; // reset to loading
  if (!slug || slug === 'support') return;

  // Check store first (free, synchronous)
  const storeBreeder = (store.state.breeders as any[]).find((b) => b.id === slug);
  if (storeBreeder !== undefined) {
    activeBreederOwnerUid.value = storeBreeder.ownerUid || null;
    return;
  }

  // Fall back to a direct read for listings not yet in the store
  try {
    const snap = await getDoc(doc(db, 'directory_members', slug));
    activeBreederOwnerUid.value = snap.exists() ? (snap.data().account?.ownerUid || null) : null;
  } catch (e) {
    console.error('Error checking breeder status:', e);
    activeBreederOwnerUid.value = null;
  }
};

const activeDisplayName = computed(() => {
  if (!activeThread.value) return '';
  return getThreadDisplayName(activeThread.value);
});

const newMessage = ref('');
const isSending = ref(false);
const isLoadingThreads = ref(true);
const isLoadingMessages = ref(false);
const messageContainer = ref<HTMLElement | null>(null);

let threadsUnsubscribe: (() => void) | null = null;
let messagesUnsubscribe: (() => void) | null = null;

const fetchThreads = () => {
  if (!user.value) return;
  isLoadingThreads.value = true;

  if (threadsUnsubscribe) threadsUnsubscribe();

  // Combine user's own threads and 'admin' threads if they are an admin
  const conditions = [where('participants', 'array-contains', user.value.uid)];

  if (isAdmin.value) {
    conditions.push(where('participants', 'array-contains', 'admin'));
  }

  if (ownedSlugs.value.length > 0) {
    // Limit to 10 to avoid Firestore limits for 'in'
    conditions.push(where('breederSlug', 'in', ownedSlugs.value.slice(0, 10)));
  }

  const q = query(
    collection(db, 'inquiry_threads'),
    or(...conditions),
    orderBy('updatedAt', 'desc')
  );

  threadsUnsubscribe = onSnapshot(q, (snapshot) => {
    threads.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InquiryThread));
    isLoadingThreads.value = false;
  }, (err) => {
    create?.({ body: `Error loading threads: ${err.message}`, variant: 'danger' });
    isLoadingThreads.value = false;
  });
};

const selectThread = (id: string) => {
  activeThreadId.value = id;
  router.push({ name: 'inbox', params: { threadId: id } });
};

// Sync activeThreadId with route params
watch(() => route.params.threadId, (newId) => {
  activeThreadId.value = (newId as string) || null;
});

const scrollToBottom = async () => {
  await nextTick();
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
  }
};

const handleRefresh = () => {
  fetchThreads();
  store.dispatch('fetchDirectory');
};

const handleContactSupport = () => contactSupport();

const markAsRead = async (threadId: string) => {
  if (!user.value) return;
  const threadRef = doc(db, 'inquiry_threads', threadId);

  // 1. Reset thread-level counter
  await updateDoc(threadRef, {
    [`unreadCount.${user.value.uid}`]: 0
  });

  // 2. Mark individual messages as read (batch)
  const unreadMessages = messages.value.filter(m => m.senderUid !== user.value?.uid && !m.read);
  if (unreadMessages.length > 0) {
    const batch = writeBatch(db);
    unreadMessages.forEach(m => {
      const msgRef = doc(db, 'inquiry_threads', threadId, 'messages', m.id!);
      batch.update(msgRef, { read: true });
    });
    await batch.commit();
  }
};

watch(activeThreadId, (newId) => {
  if (messagesUnsubscribe) messagesUnsubscribe();
  messages.value = [];
  activeBreederOwnerUid.value = undefined;

  if (!newId || newId === 'support_new') {
    isLoadingMessages.value = false;
    activeBreederOwnerUid.value = null;
    return;
  }

  isLoadingMessages.value = true;
  const q = query(
    collection(db, 'inquiry_threads', newId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  messagesUnsubscribe = onSnapshot(q, (snapshot) => {
    messages.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InquiryMessage));
    isLoadingMessages.value = false;
    scrollToBottom();
    markAsRead(newId).catch(() => {}); // suppress background write errors (e.g. after logout)
  });

  const thread = threads.value.find(t => t.id === newId);
  if (thread && thread.type !== 'support' && thread.breederSlug !== 'support') {
    fetchBreederStatus(thread.breederSlug);
  } else {
    activeBreederOwnerUid.value = null;
  }
}, { immediate: true });

const handleSend = async () => {
  if (!newMessage.value.trim() || !user.value) return;

  // First message in a new support thread — create thread + message atomically
  if (isPendingSupportThread.value) {
    isSending.value = true;
    const threadId = `support_${user.value.uid}`;
    const threadRef = doc(db, 'inquiry_threads', threadId);
    const messagesCol = collection(db, 'inquiry_threads', threadId, 'messages');
    try {
      const text = newMessage.value.trim();
      await runTransaction(db, async (transaction) => {
        transaction.set(threadRef, {
          participants: [user.value!.uid, 'admin'],
          type: 'support',
          userUid: user.value!.uid,
          userName: user.value!.displayName || 'User',
          breederSlug: 'support',
          breederName: 'Site Support',
          lastMessage: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          updatedAt: serverTimestamp(),
          unreadCount: { admin: 1 }
        });
        transaction.set(doc(messagesCol), {
          senderUid: user.value!.uid,
          text,
          createdAt: serverTimestamp(),
          read: false
        });
      });
      newMessage.value = '';
      trackEvent('support_thread_created', { thread_id: threadId });
      router.replace({ name: 'inbox', params: { threadId } });
    } catch (err: any) {
      create?.({ body: `Send failed: ${err.message}`, variant: 'danger' });
    } finally {
      isSending.value = false;
    }
    return;
  }

  if (!activeThreadId.value || !activeThread.value) return;

  isSending.value = true;
  const threadRef = doc(db, 'inquiry_threads', activeThreadId.value);
  const messagesCol = collection(db, 'inquiry_threads', activeThreadId.value, 'messages');

  try {
    const text = newMessage.value.trim();
    const lastMsgText = text.substring(0, 50) + (text.length > 50 ? '...' : '');

    // Recipient logic
    let recipientUid = activeThread.value.participants.find(p => p !== user.value?.uid) || 'admin';

    // If we're the buyer and the farm is unclaimed, the recipient is admin
    if (isUnclaimed.value) {
      recipientUid = 'admin';
    }

    await runTransaction(db, async (transaction) => {
      const threadDoc = await transaction.get(threadRef);
      const currentUnread = threadDoc.data()?.unreadCount?.[recipientUid] || 0;

      transaction.update(threadRef, {
        lastMessage: lastMsgText,
        updatedAt: serverTimestamp(),
        [`unreadCount.${recipientUid}`]: currentUnread + 1
      });

      const newMessageRef = doc(messagesCol);
      transaction.set(newMessageRef, {
        senderUid: user.value!.uid,
        text: text,
        createdAt: serverTimestamp(),
        read: false
      });
    });

    trackEvent('chat_message_sent', { thread_id: activeThreadId.value });
    newMessage.value = '';
  } catch (err: any) {
    create?.({ body: `Send failed: ${err.message}`, variant: 'danger' });
  } finally {
    isSending.value = false;
  }
};

const handleFlag = async (msg: InquiryMessage) => {
  if (!activeThreadId.value || !user.value) return;
  try {
    const msgRef = doc(db, 'inquiry_threads', activeThreadId.value, 'messages', msg.id!);
    await updateDoc(msgRef, {
      flaggedByUid: user.value.uid,
      adminReviewStatus: 'pending'
    });
    create?.({ body: 'Message flagged for review.', variant: 'info' });
  } catch (err: any) {
    create?.({ body: `Flag failed: ${err.message}`, variant: 'danger' });
  }
};

const getThreadDisplayName = (thread: InquiryThread) => {
  if (thread.type === 'support') {
    return user.value?.uid === thread.userUid 
      ? 'Site Support' 
      : formatDisplayName(thread.userName || 'User', false);
  }

  // If the user is the original buyer (userUid), the other participant is the breeder
  const isBuyer = thread.userUid === user.value?.uid;
  if (isBuyer) return thread.breederName;

  // If the user is the breeder, the other participant is the buyer
  return formatDisplayName(thread.userName || 'User', false);
};

onMounted(() => {
  fetchThreads();
});

watch([user, isAdmin], ([newUser]) => {
  if (newUser) {
    fetchThreads();
  }
}, { immediate: true });

onUnmounted(() => {
  if (threadsUnsubscribe) threadsUnsubscribe();
  if (messagesUnsubscribe) messagesUnsubscribe();
});
</script>

<template>
  <BContainer class="py-4 inbox-container">
    <BRow class="h-100 g-0 shadow-sm border rounded overflow-hidden bg-white">

      <!-- Thread List -->
      <BCol md="4" class="border-end h-100 d-flex flex-column bg-light">
        <div class="p-3 border-bottom bg-white d-flex justify-content-between align-items-center">
          <h5 class="mb-0 fw-bold">Messages</h5>
          <div class="d-flex gap-2">
            <BButton v-if="!isAdmin" variant="outline-primary" size="sm" @click="handleContactSupport" data-testid="support-btn">
              <i class="bi bi-headset me-1"></i>Support
            </BButton>
            <BButton variant="outline-primary" size="sm" @click="handleRefresh">
              <i class="bi bi-arrow-clockwise me-1"></i>Refresh
            </BButton>
          </div>
        </div>

        <div class="flex-grow-1 overflow-auto">
          <div v-if="isLoadingThreads" class="text-center py-5">
            <BSpinner variant="primary" small />
          </div>

          <BListGroup v-else flush>
            <BListGroupItem 
              v-for="thread in threads" 
              :key="thread.id"
              @click="selectThread(thread.id)"
              :active="activeThreadId === thread.id"
              class="thread-item p-3 border-bottom cursor-pointer"
              :class="{ 'unread': (thread.unreadCount?.[user?.uid!] || 0) > 0 }"
            >
              <div class="d-flex justify-content-between align-items-start mb-1">
                <h6 class="mb-0 fw-bold text-truncate" style="max-width: 150px;">
                  {{ getThreadDisplayName(thread) }}
                </h6>
                <small class="text-muted" style="font-size: 0.7rem;">
                  {{ thread.updatedAt?.toDate()?.toLocaleDateString() }}
                </small>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <p class="mb-0 small text-muted text-truncate me-2">
                  {{ thread.lastMessage }}
                </p>
                <BBadge v-if="(thread.unreadCount?.[user?.uid!] || 0) > 0" pill variant="primary" size="sm">
                  {{ thread.unreadCount?.[user?.uid!] }}
                </BBadge>
              </div>
            </BListGroupItem>

            <div v-if="threads.length === 0" class="text-center py-5 text-muted">
              <i class="bi bi-chat-dots fs-1 d-block mb-2"></i>
              No messages yet.
            </div>
          </BListGroup>
        </div>
      </BCol>

      <!-- Message Window -->
      <BCol md="8" class="h-100 d-flex flex-column bg-white position-relative">
        <div v-if="activeThread || isPendingSupportThread" class="h-100 d-flex flex-column">
          <!-- Header -->
          <div class="p-3 border-bottom bg-white d-flex align-items-center gap-3">
            <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
              {{ isPendingSupportThread ? 'S' : (activeDisplayName?.substring(0, 1) || '?') }}
            </div>
            <div>
              <h6 class="mb-0 fw-bold">{{ isPendingSupportThread ? 'Site Support' : activeDisplayName }}</h6>
              <small class="text-muted" v-if="!isPendingSupportThread && activeThread?.type !== 'support'">
                <router-link :to="{ name: 'breeder-profile', params: { slug: activeThread!.breederSlug } }" class="text-decoration-none">
                  <i class="bi bi-box-arrow-up-right me-1" style="font-size: 0.7rem;"></i>View listing
                </router-link>
              </small>
              <small class="text-muted" v-else>
                Site Support Ticket
              </small>
            </div>
          </div>

          <!-- Unclaimed Banner -->
          <BAlert v-if="isUnclaimed" variant="warning" show class="mb-0 border-0 border-bottom rounded-0 py-2 small">
            <i class="bi bi-info-circle me-2"></i>
            This listing has not been claimed. Responses may be delayed until the owner logs in.
          </BAlert>

          <!-- Messages -->
          <div ref="messageContainer" class="flex-grow-1 overflow-auto p-4 bg-light-subtle">
            <div v-if="isLoadingMessages" class="text-center py-5">
              <BSpinner variant="primary" />
            </div>

            <template v-else>
              <div v-if="isPendingSupportThread" class="h-100 d-flex flex-column align-items-center justify-content-center text-muted text-center py-5">
                <i class="bi bi-headset fs-1 opacity-25 mb-3"></i>
                <p class="mb-0">Describe your issue below and we'll get back to you shortly.</p>
              </div>

              <div v-for="msg in messages" :key="msg.id" class="d-flex mb-3" :class="msg.senderUid === user?.uid ? 'justify-content-end' : 'justify-content-start'">
                <div 
                  class="message-bubble p-3 rounded-4 shadow-sm position-relative group"
                  :class="msg.senderUid === user?.uid ? 'bg-primary text-white' : 'bg-white border text-dark'"
                  style="max-width: 75%;"
                >
                  <div v-if="msg.adminReviewStatus === 'hidden'" class="fst-italic small opacity-75">
                    [This message was removed for violating community guidelines]
                  </div>
                  <div v-else>
                    {{ msg.text }}
                  </div>

                  <div class="d-flex justify-content-between align-items-center mt-2 opacity-50" style="font-size: 0.65rem;">
                    <div class="d-flex align-items-center gap-1">
                      <span>{{ msg.createdAt?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                      <span v-if="msg.senderUid === user?.uid" class="ms-1" :title="msg.read ? 'Read' : 'Sent'">
                        <i v-if="msg.read" class="bi bi-check-circle-fill text-white"></i>
                        <i v-else class="bi bi-circle text-white"></i>
                      </span>
                    </div>
                    <button 
                      v-if="msg.senderUid !== user?.uid && !msg.flaggedByUid" 
                      @click="handleFlag(msg)"
                      class="btn btn-link p-0 text-reset ms-2 flag-btn"
                      title="Flag for review"
                    >
                      <i class="bi bi-flag"></i>
                    </button>
                    <i v-else-if="msg.flaggedByUid && msg.flaggedByUid === user?.uid" class="bi bi-flag-fill text-danger ms-2" title="Flagged by you"></i>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Input -->
          <div class="p-3 border-top bg-white">
            <div class="input-group">
              <BFormTextarea 
                v-model="newMessage"
                :placeholder="isPendingSupportThread ? 'Describe your issue...' : 'Write a reply...'"
                rows="1"
                class="border-0 bg-light rounded-4 no-focus-ring"
                @keyup.enter.exact="handleSend"
                :disabled="isSending"
                max-rows="4"
              />
              <BButton 
                variant="primary" 
                class="rounded-circle ms-2 d-flex align-items-center justify-content-center" 
                style="width: 40px; height: 40px;"
                @click="handleSend"
                :disabled="!newMessage.trim() || isSending"
              >
                <BSpinner v-if="isSending" small />
                <i v-else class="bi bi-send-fill"></i>
              </BButton>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="h-100 d-flex flex-column align-items-center justify-content-center text-muted p-5 text-center">
          <i class="bi bi-mailbox fs-1 opacity-25 mb-3"></i>
          <h5>Your Inbox</h5>
          <p>Select a conversation from the left to start messaging.</p>
        </div>
      </BCol>
    </BRow>
  </BContainer>
</template>

<style scoped>
.inbox-container {
  height: calc(100vh - 120px);
  min-height: 500px;
}

.cursor-pointer {
  cursor: pointer;
}

.thread-item:hover {
  background-color: #f8f9fa;
}

.thread-item.active {
  background-color: #e9ecef !important;
  border-left: 4px solid var(--bs-primary) !important;
  color: inherit !important;
}

.unread {
  background-color: #fff !important;
}

.unread h6 {
  color: #000;
}

.no-focus-ring:focus {
  box-shadow: none;
}

.message-bubble {
  word-wrap: break-word;
}

.flag-btn {
  visibility: hidden;
  text-decoration: none;
}

.message-bubble:hover .flag-btn {
  visibility: visible;
}

@media (max-width: 768px) {
  .inbox-container {
    height: auto;
  }
}
</style>