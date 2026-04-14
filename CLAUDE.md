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

**Vue 3 SPA** backed by **Firebase** (Firestore, Auth, Storage). Hash-based routing for static hosting compatibility.

### Firebase Collections

| Collection | Purpose |
|---|---|
| `directory_members` | Published breeder listings |
| `draft_profiles` | Unpublished drafts owned by users |
| `users` | User accounts & metadata (incl. `isAdmin`) |
| `inquiry_threads` | Messaging threads |
| `inquiry_messages` | Individual messages within threads |
| `claim_requests` | Pending ownership claims for listings |

### State Management (`src/store/index.ts`)

Vuex store with these key state slices:
- `breeders[]` — all published listings
- `myDrafts[]` — current user's draft listings
- `user` / `userData` — Firebase Auth user + user Firestore doc
- `authReady` — guards rendering until auth is initialized

Key actions: `initAuth`, `loginWithFacebook`, `fetchDirectory`, `fetchBreeder(slug)`, `createDraftListing`, `fetchMyDrafts`, `fetchActiveClaims`.

Key getters: `isLoggedIn`, `isAdmin`, `myBreeders`, `featuredBreeder`, `suggestedClaim`.

### Content Lifecycle

Breeders go through a draft → published flow:
1. User creates a **draft** in `draft_profiles` via `BreederSignupView`
2. Admin or owner publishes it → moves to `directory_members`
3. Published listings are publicly visible; drafts are only visible to the owner

### Routing (`src/router/index.ts`)

```
/                    → HomeView (landing with anchor sections: #about, #directory, #products, #resources)
/directory/:slug     → BreederProfileView
/directory/:slug/edit → BreederEditView
/get-listed/:slug?   → BreederSignupView
/inbox/:threadId?    → InboxView
/admin/inbox         → AdminInboxView
/legal               → LegalView
```

### Key Types (`src/types.ts`)

`Breeder` is the central type, mirroring both `directory_members` and `draft_profiles` documents. Fields of note:
- `id` — doubles as the URL slug
- `ownerUid` — links to Firebase Auth UID
- `status: 'published' | 'draft'`
- `verified` — admin-verified badge
- `founding_breeder` — week number for rotating featured breeder algorithm

### Firebase / Emulator Setup

`src/firebase.ts` reads `VITE_*` env vars. Set `VITE_APP_USE_EMULATOR=true` in `.env` to connect to local emulators instead of production Firebase. See `.env.sample` for all required vars.

### Testing

- Framework: **Vitest** with jsdom environment
- Setup file: `src/__tests__/setup.ts` — registers Bootstrap-Vue-Next globally, mocks `useToast`
- Helpers: `src/__tests__/test-helpers.ts`
- Test types: component unit tests (`src/components/__tests__/`), composable tests (`src/composables/__tests__/`), Firestore security rule tests (`security_rules.spec.ts`), and flow/integration tests (`src/__tests__/flows/`)
