# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (run both in parallel)
npm run emulate        # Start Firebase emulators (Auth :9099, Firestore :8080, Storage :9199, UI :4000)
npm run dev            # Start Vite dev server at :5173

# Seeding / persisting emulator data
npm run emulate:seed         # Seed emulators with test data
npm run emulate:persist      # Start emulators and persist state to seed-data/
npm run emulate:export       # Export current emulator state to seed-data/

# Build & preview
npm run build          # vue-tsc type check + Vite build → dist/
npm run preview        # Preview production build

# Tests
npm run test                          # Run all Vitest tests
npm run test -- ContactButton.spec.ts # Run a single test file
npm run test -- --grep "test name"    # Run matching tests
```

## Architecture

**Vue 3 SPA** backed by **Firebase** (Firestore, Auth, Storage, Cloud Functions). Hash-based routing for static hosting compatibility.

### Firebase Collections

| Collection | Purpose |
|---|---|
| `directory_members` | Published breeder listings |
| `draft_profiles` | Unpublished drafts owned by users |
| `draft_profile_history` | Snapshot written each time a draft is published |
| `users` | User accounts & metadata (incl. `isAdmin`, `fcmTokens`) |
| `inquiry_threads` | Messaging threads (inquiry, support, peer) |
| `inquiry_threads/{id}/messages` | Individual messages — subcollection, NOT a top-level collection |
| `claim_requests` | Pending ownership claims for listings |
| `classifieds` | Live classified listings (active, expired, discarded) |
| `draft_classifieds` | Pending classifieds awaiting admin review |
| `draft_classified_history` | Review records for classifieds (approved / rejected) |

### State Management (`src/store/index.ts`)

Vuex store with these key state slices:
- `breeders[]` — all published listings
- `myDrafts[]` — current user's draft listings
- `user` / `userData` — Firebase Auth user + user Firestore doc
- `authReady` — guards rendering until auth is initialized

Key actions: `initAuth`, `loginWithFacebook`, `fetchDirectory`, `fetchBreeder(slug)`, `createDraftListing`, `fetchMyDrafts`, `fetchActiveClaims`.

Key getters: `isLoggedIn`, `isAdmin`, `myBreeders`, `featuredBreeder`, `suggestedClaim`, `ownedSlugs`.

### Content Lifecycle

**Breeder profiles:**
1. User creates a **draft** in `draft_profiles` via `BreederSignupView`
2. Admin or owner publishes it → snapshot written to `draft_profile_history`, listing moved to `directory_members`
3. Published listings are publicly visible; drafts are only visible to the owner

**Classifieds:**
1. User submits → `draft_classifieds`
2. Admin approves or rejects → record written to `draft_classified_history`
3. On approval → document moved to `classifieds` with `status: 'active'` and a 30-day `expires_at`
4. Lifecycle: active → expired (daily sweep) or discarded (owner/admin action)
5. Owners can renew within the renewal window; verified farm owners get 3 renewals vs 1 for freemium

**User tiers** (classifieds capacity):
- `freemium` — 2 active or pending listings
- `premium` — 10 active or pending listings (requires a verified `directory_members` listing)

### Cloud Functions (`functions/src/index.ts`)

All functions run in `us-east1`. Email is sent via **Resend** (`RESEND_API_KEY` secret).

**Firestore triggers:**
- `onDraftProfileCreated` — emails admin when a new draft profile is submitted
- `onDraftProfilePublished` — emails owner when their listing goes live
- `onDirectoryMemberUpdated` — emails new owner when a claim is approved
- `onInquiryThreadCreated` — emails participants on first contact (inquiry, support, peer)
- `onDraftClassifiedCreated` — emails admin + submitter when a classified is submitted
- `onDraftClassifiedReviewAction` — publishes or rejects a classified; emails owner
- `onClassifiedAction` — handles `renew` and `discard` actions on classifieds

**Scheduled jobs:**
- `sweepExpiredClassifieds` — daily: expires overdue listings, sends 7-day warnings, cleans up old Storage images
- `sweepExpiredFarmImages` — daily: deletes orphaned profile images from Storage
- `sweepUnreadThreadNotifications` — every 30 min: emails participants with unread messages that went quiet >2 hours ago

**Callable functions:**
- `adminSendEmail` — bulk email sender (admin only); supports welcome, claim-reminder, verification-nudge, announcement templates
- `setLocalEmail` / `verifyLocalEmail` — HMAC-verified local notification email flow for users without a Facebook email
- `initiatePeerThread` — finds or creates a peer-to-peer thread; runs server-side because client rules forbid cross-user reads
- `cloneExpiredClassified` — re-lists an expired classified as a new active listing

**Identity trigger:**
- `verifyFacebookEmailOnCreate` — blocking function that sets `emailVerified: true` for Facebook OAuth users at creation time (Facebook omits the OIDC claim)

### Routing (`src/router/index.ts`)

```
/                      → HomeView
/directory             → DirectoryView
/directory/:slug       → BreederProfileView
/directory/:slug/edit  → BreederEditView
/get-listed/:slug?     → BreederSignupView
/classified            → ClassifiedsView
/classified/new        → NewClassifiedView
/classified/:docId     → ClassifiedDetailView
/inbox/:threadId?      → InboxView
/admin/inbox           → AdminInboxView
/admin/email           → AdminEmailView
/profile               → UserProfileView
/verify-email          → VerifyEmailView (HMAC token from email link)
/resources             → ResourcesView
/legal                 → LegalView
```

### Key Types (`src/types.ts`)

**`Breeder`** — flattened store-side type used in `breeders[]` state. Fields of note:
- `id` — doubles as the URL slug
- `ownerUid` — links to Firebase Auth UID
- `status: 'published' | 'draft'`
- `verified` — admin-verified badge
- `founding_breeder` — week number for rotating featured breeder algorithm

**`FirestoreMember`** — mirrors the raw shape of `directory_members` / `draft_profiles` documents (nested `profile`, `offerings`, `media`, `account` sub-objects).

**`Classified` / `DraftClassified`** — mirror `classifieds` and `draft_classifieds` documents respectively.

**`InquiryThread`** — mirrors `inquiry_threads` documents. Tracks `unreadCount: Record<uid, number>` and `lastNotifiedAt: Record<uid, Timestamp>`.

**`InquiryMessage`** — mirrors the `messages` subcollection documents. Includes optional moderation fields (`flaggedByUid`, `adminReviewStatus`).

**`ClassifiedCategory`** — `'iso' | 'for_sale' | 'rehoming' | 'hatching_eggs'`

**`UserTier`** — `'freemium' | 'premium'` with limits defined in `TIER_LIMITS`.

### Known Issue: Facebook Login on Android

Android's App Links feature hands off `m.facebook.com` OAuth URLs to the Facebook native app, which silently fails — the redirect returns no user and auth never completes.

**Device-level fix (the only reliable workaround):** In the Facebook app, go to Settings → Media & Contacts (or Browser) → disable "Open links in Facebook" / "Links open externally". This forces OAuth through the system browser where it completes normally.

There is no code-level fix. `signInWithPopup` has the same problem (popup tab also gets intercepted). Chrome 137+ Custom Tabs may eventually resolve this at the browser level.

### Firebase / Emulator Setup

`src/firebase.ts` reads `VITE_*` env vars. Set `VITE_APP_USE_EMULATOR=true` in `.env` to connect to local emulators instead of production Firebase. See `.env.sample` for all required vars.

**FCM (push notifications) is not emulated.** The emulator suite has no FCM service. However, the Functions emulator makes real outbound network calls, so a locally-running function can call the real FCM API. Browser permission + token registration also works on `localhost` with real Firebase credentials.

### Testing

- Framework: **Vitest** with jsdom environment
- Setup file: `src/__tests__/setup.ts` — registers Bootstrap-Vue-Next globally, mocks `useToast`
- Helpers: `src/__tests__/test-helpers.ts`
- Test types: component unit tests (`src/components/__tests__/`), composable tests (`src/composables/__tests__/`), Firestore security rule tests (`security_rules.spec.ts`), and flow/integration tests (`src/__tests__/flows/`)
