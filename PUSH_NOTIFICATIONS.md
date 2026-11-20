# Push Notifications Plan

## What we're building

Real-time browser push when a new message arrives in any inbox thread (inquiry, peer, support).
Replaces the current "wait 2 hours, send an email nudge" loop for users who opt in.

---

## Browser compatibility

| Browser | Support | Notes |
|---|---|---|
| Chrome | ✅ Full | FCM's native target |
| Edge | ✅ Full | Chromium-based, identical to Chrome |
| Firefox | ✅ Full | Uses Mozilla's push infrastructure; FCM SDK handles it transparently |
| Opera / Brave / Samsung Internet | ✅ Full | Chromium-based |
| Safari macOS 13+ | ✅ Full | Web Push in Safari 16.1+; Declarative Web Push (no service worker needed) in regular tabs since Safari 18.5 / macOS 15.5 |
| Safari iOS 16.4–25 | ⚠️ PWA only | Works only when site is added to home screen. Push permission cannot be shown in a regular browser tab — Apple restriction. |
| Safari iOS 26+ | ⚠️ PWA only | Home screen requirement still in place. However, iOS 26 automatically opens any home screen shortcut as a web app (no manifest needed), so the add-to-home-screen friction is lower. |
| Safari iOS < 16.4 | ❌ None | |

**iOS implication:** iPhone users in a regular Safari tab get no push regardless of iOS version.
The existing email nudge is their fallback. This is not a blocker — opt-in push is an enhancement, not a replacement.

**Declarative Web Push** (Safari 18.4+, WWDC 2025): a new Apple standard that delivers push as plain
JSON with no service worker required. Currently only works in regular browser tabs on macOS. On iOS it
still requires a home screen PWA. Our implementation uses FCM + a service worker (the standard path);
Declarative Web Push would be a separate implementation if we ever want to pursue it.

---

## Implementation pieces

### 1. FCM init (`src/firebase.ts`)
Add `getMessaging()` alongside the existing `auth`, `db`, `storage` exports.
Export the VAPID key from env (`VITE_FCM_VAPID_KEY`).

### 2. Service worker (`public/firebase-messaging-sw.js`)
Receives FCM messages when the tab is in the background or closed.
Shows a system notification with the sender name and a click URL to `/#/inbox/{threadId}`.

```js
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-messaging-compat.js');

firebase.initializeApp({ /* config */ });
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    data: payload.data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.link));
});
```

### 3. Composable (`src/composables/useNotifications.ts`)
- `requestPermission()` — calls `Notification.requestPermission()`, then `getToken(messaging, { vapidKey })`,
  then writes the token to `users/{uid}.fcmTokens` via `arrayUnion`
- `revokeToken()` — removes the current token via `arrayRemove` on logout
- Reactive `permissionState` ref for the UI to respond to

### 4. Store integration (`src/store/index.ts`)
After successful auth in `initAuth`, call `requestPermission()` non-blocking.
Do not gate login on it — a permission denial or browser that doesn't support it must never break auth.

### 5. Opt-in UI (`src/views/InboxView.vue`)
Small dismissible banner at the top of the inbox:
> "Get notified of new messages — Enable notifications"

- Only renders if `Notification.permission === 'default'` and browser supports the API
- One click triggers `requestPermission()`
- Dismissed state stored in `localStorage` so it doesn't re-appear after a denial

### 6. Cloud Function (`functions/src/index.ts`)

**Trigger:** `onDocumentCreated('inquiry_threads/{threadId}/messages/{messageId}')`

Logic:
1. Read the parent thread doc to get `participants` and `unreadCount`
2. Skip the sender's own uid
3. For each recipient where `unreadCount[uid] > 0`, load `users/{uid}.fcmTokens`
4. Call `getMessaging().sendEachForMulticast({ tokens, notification, webpush })`
5. On response, collect any tokens that returned `messaging/registration-token-not-registered`
   and remove them from `users/{uid}.fcmTokens` via `arrayRemove` — keeps token lists clean automatically

```ts
export const onInquiryMessageCreated = onDocumentCreated(
  { document: 'inquiry_threads/{threadId}/messages/{messageId}' },
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const threadId = event.params.threadId;
    const senderUid = message.senderUid as string;

    const threadSnap = await db.collection('inquiry_threads').doc(threadId).get();
    const thread = threadSnap.data();
    if (!thread) return;

    const participants: string[] = thread.participants || [];
    const unreadCount: Record<string, number> = thread.unreadCount || {};

    const recipients = participants.filter(
      uid => uid !== 'admin' && uid !== senderUid && (unreadCount[uid] ?? 0) > 0
    );
    if (recipients.length === 0) return;

    const senderName = message.senderName || 'Someone';
    const preview = (message.text as string || '').substring(0, 80);
    const link = `https://ctchickens.com/#/inbox/${threadId}`;

    for (const uid of recipients) {
      const userSnap = await db.collection('users').doc(uid).get();
      const tokens: string[] = userSnap.data()?.fcmTokens ?? [];
      if (tokens.length === 0) continue;

      const response = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: senderName, body: preview },
        webpush: { fcmOptions: { link } },
      });

      const staleTokens = response.responses
        .map((r, i) => r.error?.code === 'messaging/registration-token-not-registered' ? tokens[i] : null)
        .filter(Boolean) as string[];

      if (staleTokens.length > 0) {
        await db.collection('users').doc(uid).update({
          fcmTokens: FieldValue.arrayRemove(...staleTokens),
        });
      }
    }
  }
);
```

### 7. Firestore security rule addition

```
match /users/{uid} {
  // existing rules ...
  allow update: if request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['fcmTokens']);
}
```

Users can only update their own `fcmTokens` field, nothing else via this path.

---

## Firestore schema addition

`users/{uid}` gains `fcmTokens: string[]`.
Written by the client composable, read only by Cloud Functions (not accessible to other clients via security rules).

---

## What doesn't change

`sweepUnreadThreadNotifications` stays as-is. Push covers opted-in users in real time;
the email nudge is the fallback for everyone else and for stale/expired service worker registrations.

---

## Testing strategy

**FCM has no local emulator** (firebase/firebase-tools #4222, open since 2022, no movement).

- **Unit tests:** mock `admin.messaging()` with Vitest. Verify `sendEachForMulticast` is called with the
  correct tokens and payload, and that stale tokens are removed from Firestore.
  Firestore reads/writes run against the emulated Firestore normally.
- **End-to-end:** one-time manual verification against a separate dev Firebase project.
  Real browser, real permission grant, real push arrives. Not something to automate.

---

## Estimated scope

| Step | Effort |
|---|---|
| FCM init + service worker | ~1 hr |
| `useNotifications` composable | ~1 hr |
| Opt-in UI in InboxView | ~30 min |
| Cloud Function + token cleanup | ~2 hrs |
| Security rule + unit tests | ~1 hr |
| **Total** | **~5.5 hrs** |

---

## Out of scope

- Admin push for pending drafts/classifieds (email is fine; admin is at a desk)
- iOS home screen PWA setup / manifest work (small audience, high effort)
- In-app notification center or history
