<script setup lang="ts">
import { ref, onUnmounted, computed, watch, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import { db, trackEvent } from '../firebase';
import { 
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, runTransaction,
  writeBatch, or
} from 'firebase/firestore';
import { 
  BContainer, BRow, BCol, BListGroup, BListGroupItem, 
  BFormTextarea, BButton, BSpinner, BBadge, useToast, BAlert
} from 'bootstrap-vue-next';
import { useBreederUtils, formatDateDivider, isSameDay } from '../composables/useBreederUtils';
import { useSupport } from '../composables/useSupport';
import { useNotifications } from '../composables/useNotifications';
import { renderMessage, stripMarkdown } from '../composables/useMessageRenderer';
import type { InquiryThread, InquiryMessage } from '../types';

const store = useStore();
const route = useRoute();
const router = useRouter();
const { create } = useToast();
const { formatDisplayName } = useBreederUtils();
const { contactSupport } = useSupport();
const { requestPermission, sendTestNotification, permissionState, isPushSupported } = useNotifications();

// Shown by both banners' X buttons below — the controls still exist once
// dismissed here, just moved to the profile page instead of gone for good.
const notifyManageFromProfile = () => {
  create?.({ body: 'You can manage this anytime from your profile page.', variant: 'info' });
};

// Opt-in push notification banner — shown once until dismissed or permission granted.
const notifBannerDismissed = ref(localStorage.getItem('push-banner-dismissed') === '1');
const showNotifBanner = computed(() => {
  if (notifBannerDismissed.value) return false;
  if (!isPushSupported) return false;
  return permissionState.value === 'default';
});

const dismissNotifBanner = () => {
  notifBannerDismissed.value = true;
  localStorage.setItem('push-banner-dismissed', '1');
};

const handleDismissNotifBanner = () => {
  dismissNotifBanner();
  notifyManageFromProfile();
};

const handleEnableNotifications = async () => {
  await requestPermission();
  // Not a user dismissal — just hide the opt-in prompt now that it's moot.
  dismissNotifBanner();
};

// Lets anyone confirm their own push setup actually works, without needing a
// second account to send themselves a message. The full status/enable/test
// controls also live on the profile page's Notifications section.
const testNotifBannerDismissed = ref(localStorage.getItem('push-test-banner-dismissed') === '1');
const showTestNotifButton = computed(() => !testNotifBannerDismissed.value && permissionState.value === 'granted');
const isSendingTestNotif = ref(false);

const handleDismissTestNotifBanner = () => {
  testNotifBannerDismissed.value = true;
  localStorage.setItem('push-test-banner-dismissed', '1');
  notifyManageFromProfile();
};

const handleSendTestNotification = async () => {
  isSendingTestNotif.value = true;
  try {
    await sendTestNotification();
    create?.({ body: 'Test notification sent — check for it now.', variant: 'success' });
  } catch (err: any) {
    create?.({ body: `Couldn't send a test notification: ${err.message}`, variant: 'danger' });
  } finally {
    isSendingTestNotif.value = false;
  }
};

const user = computed(() => store.state.user);
const isAdmin = computed(() => store.getters.isAdmin);
const ownedSlugs = computed(() => store.getters.ownedSlugs);

const threads = ref<InquiryThread[]>([]);
const messages = ref<InquiryMessage[]>([]);
const activeThreadId = ref<string | null>((route.params.threadId as string) || null);
const activeThread = computed(() => threads.value.find(t => t.id === activeThreadId.value));
const isPendingSupportThread = computed(() => activeThreadId.value === 'support_new');

// Pairs each message with a date-divider label ("Today", "Yesterday", "November 15")
// to show above it, or null when it falls on the same day as the message before it.
// A message still awaiting its server timestamp (createdAt not yet set) gets no
// divider, so the divider doesn't flicker in before the real date resolves.
const messagesWithDividers = computed(() => messages.value.map((msg, index) => {
  const date = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
  if (!date) return { msg, divider: null as string | null };

  const prevDate = index > 0 && messages.value[index - 1].createdAt?.toDate
    ? messages.value[index - 1].createdAt.toDate()
    : null;

  const divider = (prevDate && isSameDay(date, prevDate)) ? null : formatDateDivider(date);
  return { msg, divider };
}));

const isClosedSupportThread = computed(() =>
  activeThread.value?.type === 'support' && activeThread.value.status === 'closed'
);

const isUnclaimed = computed(() => {
  if (!activeThread.value || activeThread.value.type === 'support' || activeThread.value.type === 'peer') return false;
  if (activeThread.value.userUid !== user.value?.uid) return false;
  const slug = activeThread.value.breederSlug;
  if (!slug || slug === 'support') return false;
  if (!store.state.lastFetch) return false;
  const breeder = (store.state.breeders as any[]).find(b => b.id === slug);
  return !breeder?.ownerUid;
});

const activeDisplayName = computed(() => {
  if (!activeThread.value) return '';
  return getThreadDisplayName(activeThread.value);
});

const mobilePanel = ref<'threads' | 'messages'>(activeThreadId.value ? 'messages' : 'threads');

const newMessage = ref('');
const isSending = ref(false);
const isLoadingThreads = ref(true);
const isLoadingMessages = ref(false);
const messageContainer = ref<HTMLElement | null>(null);
const textareaRef = ref<InstanceType<typeof BFormTextarea> | null>(null);

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
  mobilePanel.value = 'messages';
  if (activeThreadId.value === id) return;
  activeThreadId.value = id;
  router.push({ name: 'inbox', params: { threadId: id } });
};

// Sync activeThreadId with route params
watch(() => route.params.threadId, (newId) => {
  activeThreadId.value = (newId as string) || null;
  mobilePanel.value = newId ? 'messages' : 'threads';
});

watch(activeThread, (thread) => {
  if (thread) focusTextarea();
});

const scrollToBottom = async () => {
  await nextTick();
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
  }
};

const focusTextarea = async () => {
  if (window.innerWidth < 768) return;
  await nextTick();
  (textareaRef.value?.$el as HTMLElement)?.focus();
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

  if (!newId || newId === 'support_new') {
    isLoadingMessages.value = false;
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
          senderName: user.value!.displayName || 'User',
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
        senderName: user.value!.displayName || 'User',
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

const isTogglingThreadStatus = ref(false);
const handleToggleThreadStatus = async () => {
  if (!activeThread.value || activeThread.value.type !== 'support') return;
  const nextStatus = activeThread.value.status === 'closed' ? 'open' : 'closed';
  isTogglingThreadStatus.value = true;
  try {
    await updateDoc(doc(db, 'inquiry_threads', activeThread.value.id), { status: nextStatus });
    create?.({ body: nextStatus === 'closed' ? 'Support ticket closed.' : 'Support ticket reopened.', variant: 'success' });
  } catch (err: any) {
    create?.({ body: `Could not update ticket: ${err.message}`, variant: 'danger' });
  } finally {
    isTogglingThreadStatus.value = false;
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

const threadTypeLabel = (thread: InquiryThread) => {
  if (thread.type === 'support') return 'Support';
  if (thread.type === 'peer') return 'Direct';
  return 'Inquiry';
};

const threadTypeVariant = (thread: InquiryThread) => {
  if (thread.type === 'support') return 'info';
  if (thread.type === 'peer') return 'secondary';
  return 'primary';
};

const getThreadDisplayName = (thread: InquiryThread) => {
  if (thread.type === 'support') {
    return user.value?.uid === thread.userUid
      ? 'Site Support'
      : formatDisplayName(thread.userName || 'User', false);
  }

  if (thread.type === 'peer') {
    const otherUid = thread.participants.find(p => p !== user.value?.uid);
    return (otherUid && thread.peerParticipantNames?.[otherUid]) || 'Direct Message';
  }

  // If the user is the original buyer (userUid), the other participant is the breeder
  const isBuyer = thread.userUid === user.value?.uid;
  if (isBuyer) return thread.breederName;

  // If the user is the breeder, the other participant is the buyer
  return formatDisplayName(thread.userName || 'User', false);
};

const getRespondingAsLabel = (thread: InquiryThread) => {
  if (!user.value) return null;
  
  // Peer threads (user initiated the thread as a farm)
  if (thread.type === 'peer' && thread.userUid === user.value.uid && thread.senderFarmSlug) {
    return thread.peerParticipantNames?.[user.value.uid];
  }

  // Standard listing inquiries (user is the farm owner/responder)
  if (thread.type !== 'peer' && thread.type !== 'support' && thread.breederSlug && thread.breederSlug !== 'support') {
    const isBuyer = thread.userUid === user.value.uid;
    if (!isBuyer) {
      return thread.breederName;
    }
  }

  return null;
};

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
      <BCol md="4" :class="['border-end h-100 flex-column bg-light', mobilePanel === 'messages' ? 'd-none d-md-flex' : 'd-flex']">
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

        <!-- Push notification opt-in banner -->
        <div
          v-if="showNotifBanner"
          class="d-flex align-items-center px-3 py-2 border-bottom bg-info bg-opacity-10 small"
          data-testid="push-banner"
        >
          <i class="bi bi-bell-fill me-2 text-primary flex-shrink-0"></i>
          <span class="flex-grow-1 text-muted">Get notified of new messages.</span>
          <button
            class="btn btn-link btn-sm p-0 me-3 fw-semibold text-decoration-none"
            @click="handleEnableNotifications"
          >Enable</button>
          <button
            type="button"
            class="btn-close"
            style="font-size: 0.65rem;"
            aria-label="Dismiss"
            @click="handleDismissNotifBanner"
          ></button>
        </div>

        <!-- Lets anyone confirm their own push setup actually works -->
        <div
          v-if="showTestNotifButton"
          class="d-flex align-items-center px-3 py-2 border-bottom bg-light small"
          data-testid="test-push-banner"
        >
          <i class="bi bi-bell me-2 text-muted flex-shrink-0"></i>
          <span class="flex-grow-1 text-muted">Notifications are on.</span>
          <button
            class="btn btn-link btn-sm p-0 me-3 fw-semibold text-decoration-none"
            :disabled="isSendingTestNotif"
            data-testid="send-test-notification-btn"
            @click="handleSendTestNotification"
          >{{ isSendingTestNotif ? 'Sending…' : 'Send test notification' }}</button>
          <button
            type="button"
            class="btn-close"
            style="font-size: 0.65rem;"
            aria-label="Dismiss"
            @click="handleDismissTestNotifBanner"
          ></button>
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
              :active="activeThreadId === thread.id && mobilePanel === 'messages'"
              class="thread-item p-3 border-bottom cursor-pointer"
              :class="{ 'unread': (thread.unreadCount?.[user?.uid!] || 0) > 0 }"
            >
              <div class="d-flex justify-content-between align-items-start mb-1">
                <h6 class="mb-0 fw-bold text-truncate" style="max-width: 60%;">
                  {{ getThreadDisplayName(thread) }}
                </h6>
                <small class="text-muted" style="font-size: 0.7rem;">
                  {{ thread.updatedAt?.toDate()?.toLocaleDateString() }}
                </small>
              </div>
              <div class="d-flex align-items-center gap-1 mb-1">
                <BBadge :variant="threadTypeVariant(thread)" pill style="font-size: 0.6rem;">{{ threadTypeLabel(thread) }}</BBadge>
                <BBadge v-if="thread.type === 'support' && thread.status === 'closed'" variant="secondary" pill style="font-size: 0.6rem;">Closed</BBadge>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <p class="mb-0 small text-muted text-truncate me-2">
                  {{ stripMarkdown(thread.lastMessage) }}
                </p>
                <BBadge v-if="(thread.unreadCount?.[user?.uid!] || 0) > 0" pill variant="primary" size="sm">
                  {{ thread.unreadCount?.[user?.uid!] }}
                </BBadge>
              </div>
              <div v-if="getRespondingAsLabel(thread)" class="mt-1">
                <small class="text-primary fw-bold" style="font-size: 0.7rem;">
                  as {{ getRespondingAsLabel(thread) }}
                </small>
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
      <BCol md="8" :class="['h-100 flex-column bg-white position-relative', mobilePanel === 'threads' ? 'd-none d-md-flex' : 'd-flex']">
        <div v-if="activeThread || isPendingSupportThread" class="h-100 d-flex flex-column">
          <!-- Header -->
          <div class="p-3 border-bottom bg-white d-flex align-items-center gap-3">
            <button class="btn btn-link p-0 d-md-none text-dark" @click="router.push({ name: 'inbox' })" aria-label="Back to messages">
              <i class="bi bi-arrow-left fs-5"></i>
            </button>
            <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
              {{ isPendingSupportThread ? 'S' : (activeDisplayName?.substring(0, 1) || '?') }}
            </div>
            <div>
              <h6 class="mb-0 fw-bold">{{ isPendingSupportThread ? 'Site Support' : activeDisplayName }}</h6>
              <small class="text-muted" v-if="!isPendingSupportThread && activeThread?.type !== 'support' && activeThread?.type !== 'peer' && activeThread?.breederSlug">
                <template v-if="getRespondingAsLabel(activeThread)">
                  responding as {{ getRespondingAsLabel(activeThread) }}
                </template>
                <router-link v-else :to="{ name: 'breeder-profile', params: { slug: activeThread.breederSlug } }" class="text-decoration-none">
                  <i class="bi bi-box-arrow-up-right me-1" style="font-size: 0.7rem;"></i>View listing
                </router-link>
              </small>
              <small class="text-muted" v-else-if="activeThread?.type === 'peer' && activeThread?.senderFarmSlug">
                <template v-if="activeThread.userUid === user?.uid">
                  responding as {{ activeThread.peerParticipantNames?.[user?.uid!] }}
                </template>
                <router-link v-else :to="{ name: 'breeder-profile', params: { slug: activeThread.senderFarmSlug } }" class="text-decoration-none">
                  <i class="bi bi-box-arrow-up-right me-1" style="font-size: 0.7rem;"></i>View listing
                </router-link>
              </small>
              <small class="text-muted" v-else-if="activeThread?.type === 'peer'">Direct message</small>
              <small class="text-muted" v-else-if="isPendingSupportThread || activeThread?.type === 'support'">
                Site Support Ticket
              </small>
            </div>
            <div class="ms-auto d-flex align-items-center gap-2">
              <BButton
                v-if="isAdmin && activeThread?.type === 'support'"
                @click="handleToggleThreadStatus"
                :variant="activeThread.status === 'closed' ? 'outline-success' : 'outline-secondary'"
                size="sm"
                :disabled="isTogglingThreadStatus"
              >
                <BSpinner v-if="isTogglingThreadStatus" small />
                <template v-else>{{ activeThread.status === 'closed' ? 'Reopen' : 'Close' }}</template>
              </BButton>
              <BBadge v-if="activeThread?.type === 'support' && activeThread.status === 'closed'" pill variant="secondary" style="font-size: 0.65rem;">Closed</BBadge>
              <BBadge v-else-if="isPendingSupportThread || activeThread?.type === 'support'" pill variant="info" style="font-size: 0.65rem;">Support</BBadge>
              <BBadge v-else-if="activeThread?.type === 'peer'" pill variant="secondary" style="font-size: 0.65rem;">Direct</BBadge>
              <BBadge v-else pill variant="primary" style="font-size: 0.65rem;">Inquiry</BBadge>
            </div>
          </div>

          <!-- Unclaimed Banner -->
          <BAlert v-if="isUnclaimed" variant="warning" show class="mb-0 border-0 border-bottom rounded-0 py-2 small">
            <i class="bi bi-info-circle me-2"></i>
            This listing has not been claimed. Responses may be delayed until the owner logs in.
          </BAlert>

          <!-- Closed Ticket Banner -->
          <BAlert v-if="isClosedSupportThread" variant="secondary" show class="mb-0 border-0 border-bottom rounded-0 py-2 small">
            <i class="bi bi-check-circle me-2"></i>
            This ticket is closed. Send a message below to reopen it.
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

              <template v-for="{ msg, divider } in messagesWithDividers" :key="msg.id">
                <div v-if="divider" class="date-divider text-center my-3">
                  <span class="badge bg-light text-muted border rounded-pill px-3 py-1 fw-normal" style="font-size: 0.7rem;">{{ divider }}</span>
                </div>

                <div class="d-flex mb-3" :class="msg.senderUid === user?.uid ? 'justify-content-end' : 'justify-content-start'">
                  <div
                    class="message-bubble p-3 rounded-4 shadow-sm position-relative group"
                    :class="msg.senderUid === user?.uid ? 'bg-primary text-white' : 'bg-white border text-dark'"
                    style="max-width: 75%;"
                  >
                    <div v-if="msg.adminReviewStatus === 'hidden'" class="fst-italic small opacity-75">
                      [This message was removed for violating community guidelines]
                    </div>
                    <div v-else v-html="renderMessage(msg.text)"></div>

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
            </template>
          </div>

          <!-- Input -->
          <div class="p-3 border-top bg-white">
            <div class="input-group">
              <BFormTextarea
                ref="textareaRef"
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
            <div class="text-end mt-1">
              <a href="https://commonmark.org/help/" target="_blank" rel="noopener noreferrer" class="text-muted" style="font-size: 0.7rem;">Markdown supported</a>
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
  white-space: pre-wrap;
}

.message-bubble.bg-primary :deep(a) {
  color: #fff;
  text-decoration: underline;
}

.message-bubble.bg-white :deep(a) {
  color: #1e40af;
  text-decoration: underline;
}

.flag-btn {
  visibility: hidden;
  text-decoration: none;
}

.message-bubble:hover .flag-btn {
  visibility: visible;
}

@media (max-width: 767px) {
  .inbox-container {
    height: calc(100vh - 120px);
    min-height: 0;
  }
}
</style>