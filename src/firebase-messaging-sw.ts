/// <reference lib="webworker" />
// Firebase Cloud Messaging background handler — service worker context.
//
// This file is compiled by vite-plugin-pwa (injectManifest strategy) as a
// separate Vite sub-build.  import.meta.env.VITE_* references are replaced
// with real values at build time — no runtime placeholders.
//
// Output: dist/firebase-messaging-sw.js (classic script / IIFE bundle).
// Firebase Messaging auto-registers this file when getToken() is called.

import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
});

const messaging = getMessaging(app);

// Called when a push message arrives while the app is backgrounded or closed.
// Foreground messages are handled in the client via onMessage() in the main bundle.
onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title ?? 'New message';
  const body = payload.notification?.body ?? '';
  const link = (payload.data as Record<string, string> | undefined)?.link ?? '/#/inbox';

  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { link },
  });
});

// Route notification clicks to the correct inbox thread.
self.addEventListener('notificationclick', (event) => {
  const e = event as NotificationEvent;
  e.notification.close();
  const link: string = (e.notification.data as { link?: string } | null)?.link ?? '/#/inbox';

  e.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Reuse an existing tab pointing to this origin if one is open.
        for (const client of windowClients) {
          if (client.url.startsWith((self as ServiceWorkerGlobalScope).location.origin) && 'focus' in client) {
            (client as WindowClient).focus();
            return (client as WindowClient).navigate(link);
          }
        }
        return (self as unknown as ServiceWorkerGlobalScope).clients.openWindow(link);
      })
  );
});
