import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export function useSupport() {
  const store = useStore();
  const router = useRouter();
  const user = computed(() => store.state.user);

  const contactSupport = async () => {
    if (!user.value) {
      store.commit('PUSH_TOAST', {
        title: 'Authentication Required',
        message: 'Please log in to contact support.',
        variant: 'warning'
      });
      return;
    }
    
    const threadId = `support_${user.value.uid}`;
    const threadRef = doc(db, 'inquiry_threads', threadId);

    try {
      const threadSnap = await getDoc(threadRef);
      if (!threadSnap.exists()) {
        await setDoc(threadRef, {
          participants: [user.value.uid, 'admin'],
          type: 'support',
          userUid: user.value.uid,
          userName: user.value.displayName || 'User',
          breederSlug: 'support',
          breederName: 'Site Support',
          lastMessage: 'Started support chat',
          updatedAt: serverTimestamp(),
          unreadCount: { 'admin': 0 }
        });
      }
      router.push({ name: 'inbox', params: { threadId } });
    } catch (err: any) {
      store.commit('PUSH_TOAST', {
        title: 'Error',
        message: `Could not start support chat: ${err.message}`,
        variant: 'danger'
      });
    }
  };

  return {
    contactSupport
  };
}
