<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { db } from '../firebase';
import { 
  doc, collection, serverTimestamp, runTransaction 
} from 'firebase/firestore';
import { 
  BModal, BFormTextarea, BButton, BSpinner, useToast 
} from 'bootstrap-vue-next';
import type { Breeder } from '../types';

const store = useStore();
const { create } = useToast();

const showModal = computed({
  get: () => store.state.showInquiryModal.show,
  set: (val) => store.dispatch('toggleInquiryModal', { show: val, breeder: store.state.showInquiryModal.breeder })
});

const breeder = computed<Breeder | undefined>(() => store.state.showInquiryModal.breeder);
const user = computed(() => store.state.user);
const userData = computed(() => store.state.userData);
const isBlocked = computed(() => userData.value?.blockedFromChat === true);
const isOwner = computed(() => user.value && breeder.value && user.value.uid === breeder.value.ownerUid);

const messageText = ref('');
const isSending = ref(false);

const handleSend = async () => {
  if (!user.value) {
    create?.({ title: 'Authentication Required', body: 'Please log in to send an inquiry.', variant: 'warning' });
    return;
  }

  if (isBlocked.value) {
    create?.({ title: 'Messaging Restricted', body: 'Your messaging privileges have been restricted.', variant: 'danger' });
    return;
  }

  if (isOwner.value) {
    create?.({ title: 'Self-Contact', body: 'You cannot send an inquiry to your own farm.', variant: 'warning' });
    return;
  }

  if (messageText.value.length < 10) {
    create?.({ body: 'Please enter at least 10 characters.', variant: 'warning' });
    return;
  }

  if (!breeder.value) return;

  isSending.value = true;
  const threadId = `${user.value.uid}_${breeder.value.id}`;
  const threadRef = doc(db, 'inquiry_threads', threadId);

  try {
    await runTransaction(db, async (transaction) => {
      const threadDoc = await transaction.get(threadRef);
      
      const lastMsg = messageText.value.substring(0, 50) + (messageText.value.length > 50 ? '...' : '');

      if (!threadDoc.exists()) {
        // Create the thread header
        transaction.set(threadRef, {
          participants: [user.value!.uid, breeder.value!.ownerUid || 'admin'].filter(Boolean),
          type: 'inquiry',
          userUid: user.value!.uid,
          userName: user.value!.displayName || 'User',
          breederSlug: breeder.value!.id,
          breederName: breeder.value!.name,
          lastMessage: lastMsg,
          updatedAt: serverTimestamp(),
          unreadCount: { [breeder.value!.ownerUid || 'admin']: 1 }
        });
      } else {
        // Update existing thread header
        const currentUnread = threadDoc.data()?.unreadCount?.[breeder.value!.ownerUid || 'admin'] || 0;
        transaction.update(threadRef, {
          lastMessage: lastMsg,
          updatedAt: serverTimestamp(),
          [`unreadCount.${breeder.value!.ownerUid || 'admin'}`]: currentUnread + 1
        });
      }

      // Add the message
      const messagesCol = collection(db, 'inquiry_threads', threadId, 'messages');
      const newMessageRef = doc(messagesCol); // Pre-generate ID for transaction
      transaction.set(newMessageRef, {
        senderUid: user.value!.uid,
        text: messageText.value,
        createdAt: serverTimestamp(),
        read: false
      });
    });

    create?.({ title: 'Success', body: 'Your inquiry has been sent!', variant: 'success' });
    messageText.value = '';
    showModal.value = false;
  } catch (e: any) {
    create?.({ title: 'Error', body: `Failed to send: ${e.message}`, variant: 'danger' });
  } finally {
    isSending.value = false;
  }
};
</script>

<template>
  <BModal v-model="showModal">
    <template #title>
      Message <span class="text-primary ms-1 fw-bold">{{ breeder?.name }}</span>
    </template>

    <div v-if="isBlocked" class="alert alert-danger">
      <i class="bi bi-exclamation-octagon me-2"></i>
      Your account is restricted from sending messages.
    </div>
    
    <div v-else-if="!user" class="text-center py-3">
      <p>You must be logged in to send a secure message.</p>
      <BButton @click="store.dispatch('loginWithFacebook')" variant="primary">
        <i class="bi bi-facebook me-2"></i> Log in with Facebook
      </BButton>
    </div>

    <div v-else>
      <p class="small text-muted mb-3">
        Inquire about availability, pricing, or ask a question. 
        Your email is kept private.
      </p>
      
      <BFormTextarea
        v-model="messageText"
        placeholder="Type your message here..."
        rows="4"
        class="mb-3"
        :disabled="isSending"
      />
    </div>

    <template #footer>
      <div v-if="user && !isBlocked" class="d-flex justify-content-end gap-2 w-100">
        <BButton variant="light" @click="showModal = false" :disabled="isSending">Cancel</BButton>
        <BButton variant="primary" @click="handleSend" :disabled="isSending || messageText.length < 10">
          <BSpinner v-if="isSending" small class="me-1" />
          <i v-else class="bi bi-send me-1"></i>
          Send Inquiry
        </BButton>
      </div>
      <div v-else></div>
    </template>
  </BModal>
</template>
