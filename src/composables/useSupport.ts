import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

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
      // If a thread already exists, go straight to it.
      // Otherwise route to the sentinel that lets the user compose their first message
      // before anything is written to Firestore or any email is sent.
      const threadSnap = await getDoc(threadRef);
      const destination = threadSnap.exists() ? threadId : 'support_new';
      router.push({ name: 'inbox', params: { threadId: destination } });
    } catch (err: any) {
      store.commit('PUSH_TOAST', {
        title: 'Error',
        message: `Could not open support chat: ${err.message}`,
        variant: 'danger'
      });
    }
  };

  return {
    contactSupport
  };
}
