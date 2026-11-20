import { ref } from 'vue';
import { getToken, deleteToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, messaging, VAPID_KEY, auth, functions } from '../firebase';

// Module-level singleton — permissionState is shared across all callers so the UI
// always reflects the current browser permission without redundant API polls.
const permissionState = ref<NotificationPermission | 'unsupported'>(
  typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
);

export function useNotifications() {
  // Computed fresh on every call (not hoisted to module scope) so it reflects
  // the browser's actual current support — tests stub Notification/PushManager
  // per-case, and a frozen module-level value would miss that.
  const isPushSupported = typeof Notification !== 'undefined' && typeof window !== 'undefined' && !!window.PushManager;

  /**
   * Requests browser notification permission, gets an FCM token, and persists it
   * to `users/{uid}.fcmTokens` via arrayUnion so the server can target this device.
   *
   * Fails silently — a denial or unsupported browser must never break auth or routing.
   */
  const requestPermission = async (): Promise<void> => {
    if (!messaging || !VAPID_KEY || !isPushSupported) {
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const permission = await Notification.requestPermission();
      permissionState.value = permission;
      if (permission !== 'granted') return;

      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (!token) return;

      await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });
    } catch (err) {
      // Suppress — a failed FCM registration must never surface to the user.
      console.warn('[useNotifications] requestPermission failed silently:', err);
    }
  };

  /**
   * Deletes the current FCM token from the service worker and removes it from
   * `users/{uid}.fcmTokens`. Called on explicit opt-out or logout.
   *
   * Fails silently — same contract as requestPermission.
   */
  const revokeToken = async (): Promise<void> => {
    if (!messaging || !VAPID_KEY || !isPushSupported) {
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      // Capture the token BEFORE deleting it — deleteToken invalidates it in the SW.
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (!token) return;

      await deleteToken(messaging);
      await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) });
    } catch (err) {
      console.warn('[useNotifications] revokeToken failed silently:', err);
    }
  };

  /**
   * Sends a push notification to the caller's own registered tokens via the
   * sendTestPushNotification callable, so anyone can confirm their own setup
   * works without needing a second account to send a real message.
   *
   * Unlike requestPermission/revokeToken, this does NOT fail silently — the
   * whole point is giving the caller feedback, so errors (rate-limited, no
   * tokens registered, etc.) propagate for the caller to display.
   */
  const sendTestNotification = async (): Promise<{ tokenCount: number }> => {
    const callable = httpsCallable<void, { ok: boolean; tokenCount: number }>(
      functions,
      'sendTestPushNotification'
    );
    const result = await callable();
    return result.data;
  };

  return { requestPermission, revokeToken, sendTestNotification, permissionState, isPushSupported };
}
