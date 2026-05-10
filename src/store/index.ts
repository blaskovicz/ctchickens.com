import { createStore } from 'vuex';
import type { ActionContext } from 'vuex';
import type { Breeder, FirestoreMember, Classified, DraftClassified, ClassifiedCategory, UserTier } from '../types';
import { db, auth, functions, facebookProvider, trackEvent } from '../firebase';
import router from '../router';
import {
  collection, getDocs, query, where, orderBy, doc, setDoc, getDoc, serverTimestamp, runTransaction, addDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { generateSlug } from '../composables/useBreederUtils';
import { TIER_LIMITS } from '../types';

const AUTH_TOAST_SUFFIX = 'Please try again. On Android, try disabling "Open links in Facebook" in Facebook app settings. If it keeps failing, clear your site data in browser settings or contact admin@ctchickens.com';

async function fullSignOut() {
  await signOut(auth);
  // signOut() flushes the redirectUser from IndexedDB but leaves Firebase's
  // sessionStorage keys (oauthHelperState, sessionId, pendingRedirect) behind.
  // These stale keys poison subsequent login attempts, so clear them explicitly.
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('firebase:')) sessionStorage.removeItem(key);
  }
}

interface State {
  breeders: Breeder[];
  myDrafts: Breeder[];
  classifieds: Classified[];
  myClassifieds: (Classified | DraftClassified)[];
  lastFetch: number;
  user: User | null; 
  userData: any | null; 
  activeClaims: string[]; // List of businessSlugs currently being claimed
  authReady: boolean;
  toasts: { message: string; title?: string; variant: string; duration?: number }[];
  showInquiryModal: { show: boolean; breeder?: Breeder };
}

const mapMemberToBreeder = (member: FirestoreMember, id: string): Breeder => {
  return {
    id,
    name: member.profile?.businessName || id,
    location: member.profile.town,
    selling: member.offerings.description,
    category: member.profile.memberType,
    verified: member.account?.isVerified || false,
    founding_breeder: member.account?.foundingMember || null, 
    contact_link: member.profile.contactEmail,
    info_link: member.profile.website,
    updated: member.account?.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    featured: false, 
    reviews: [], 
    logo: member.media.logoUrl,
    images: member.media.galleryUrls,
    ownerUid: member.account?.ownerUid || (member as any).draft_owner_uid || null,
    status: member.account?.status || 'draft'
  };
};

const getWeekNumber = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export default createStore({
  state: {
    breeders: [],
    myDrafts: [],
    classifieds: [],
    myClassifieds: [],
    lastFetch: 0,
    user: null,
    userData: null,
    activeClaims: [],
    authReady: false,
    toasts: [],
    showInquiryModal: { show: false }
  } as State,

  mutations: {
    SET_BREEDERS(state: State, payload: Breeder[]) {
      state.breeders = payload;
    },
    SET_MY_DRAFTS(state: State, payload: Breeder[]) {
      state.myDrafts = payload;
    },
    SET_CLASSIFIEDS(state: State, payload: Classified[]) {
      state.classifieds = payload;
    },
    SET_MY_CLASSIFIEDS(state: State, payload: (Classified | DraftClassified)[]) {
      state.myClassifieds = payload;
    },
    REMOVE_DRAFT(state: State, slug: string) {
      state.myDrafts = state.myDrafts.filter(d => d.id !== slug);
    },
    UPDATE_BREEDER(state: State, updatedBreeder: Breeder) {
      const index = state.breeders.findIndex(b => b.id === updatedBreeder.id);
      if (index !== -1) {
        state.breeders[index] = updatedBreeder;
      } else {
        state.breeders.push(updatedBreeder);
      }
    },
    SET_LAST_FETCH(state: State, time: number) {
      state.lastFetch = time;
    },
    SET_USER(state: State, user: User | null) {
      state.user = user;
    },
    SET_USER_DATA(state: State, data: any | null) {
      state.userData = data;
    },
    SET_ACTIVE_CLAIMS(state: State, claims: string[]) {
      state.activeClaims = claims;
    },
    SET_AUTH_READY(state: State, ready: boolean) {
      state.authReady = ready;
    },
    PUSH_TOAST(state: State, toast: State['toasts'][0]) {
      state.toasts.push(toast);
    },
    CLEAR_TOASTS(state: State) {
      state.toasts = [];
    },
    TOGGLE_INQUIRY_MODAL(state: State, payload: { show: boolean; breeder?: Breeder }) {
      state.showInquiryModal = payload;
    }
  },

  actions: {
    toggleInquiryModal({ commit }: ActionContext<State, State>, payload: { show: boolean; breeder?: Breeder }) {
      commit('TOGGLE_INQUIRY_MODAL', payload);
    },
    async initAuth({ commit, dispatch, getters, state }: ActionContext<State, State>) {
      console.log("[auth] initializing...");

      // Check sessionStorage for Firebase's pending redirect flag BEFORE calling
      // getRedirectResult() — the SDK clears it during that call, so this is the
      // only reliable window to know a redirect was actively in flight.
      // Key format confirmed from Firebase SDK source: _persistenceKeyName()
      const pendingRedirectKey = `firebase:pendingRedirect:${import.meta.env.VITE_FIREBASE_API_KEY}:[DEFAULT]`;
      const useEmulator = import.meta.env.VITE_APP_USE_EMULATOR === 'true';
      const hadPendingRedirect = !useEmulator && sessionStorage.getItem(pendingRedirectKey) !== null;
      console.log("[auth] redirect signals — sessionStorage pendingRedirect:", hadPendingRedirect);

      try {
        // 1. Handle redirect result FIRST
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          console.log("[auth] redirect sign-in succeeded", user.uid);

          await setDoc(doc(db, 'users', user.uid), {
            displayName: user.displayName ?? null,
            email: user.email ?? null,
            photoURL: user.photoURL ?? null,
            lastLogin: serverTimestamp()
          }, { merge: true });

          await Promise.all([
            dispatch('fetchUserData', user.uid),
            dispatch('fetchActiveClaims', user.uid),
            dispatch('fetchMyDrafts', user.uid),
            dispatch('fetchMyClassifieds', user.uid)
          ]);
        } else if (hadPendingRedirect) {
          // A redirect was in flight but returned no user — stale auth state
          // (e.g. cookies cleared mid-flow). Call signOut() to flush the orphaned
          // redirectUser from IndexedDB, and clear the Firebase OAuth sessionStorage
          // keys so the next login attempt starts clean.
          console.warn("[auth] redirect returned no user — clearing stale redirect state.");
          trackEvent('auth_stale_redirect_cleared');
          await fullSignOut();
          commit('PUSH_TOAST', {
            title: 'Sign-in incomplete',
            message: `Something interrupted your login. ${AUTH_TOAST_SUFFIX}`,
            variant: 'danger',
            duration: 30000
          });
        }
      } catch (error: any) {
        console.error("[auth] redirect error:", error?.code ?? error);
        trackEvent('auth_redirect_error', { error_code: error?.code ?? 'unknown' });
        commit('PUSH_TOAST', {
          title: 'Authentication Error',
          message: `${error.message || 'Login failed during redirect.'} ${AUTH_TOAST_SUFFIX}`,
          variant: 'danger',
          duration: 30000
        });
      }

      // 2. Setup observer — fire fetchDirectory in parallel since it's public data
      const directoryFetch = dispatch('fetchDirectory').catch((e: unknown) => {
        console.error("[auth] fetchDirectory failed", e);
      });

      await new Promise<void>((resolve) => {
        let isResolved = false;
        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        }, 5000);

        onAuthStateChanged(auth, async (user) => {
          console.log("[auth] state changed —", user ? `signed in as ${user.uid}` : "signed out");
          commit('SET_USER', user);

          if (user) {
            await Promise.all([
              dispatch('fetchUserData', user.uid),
              dispatch('fetchActiveClaims', user.uid),
              dispatch('fetchMyDrafts', user.uid),
              dispatch('fetchMyClassifieds', user.uid)
            ]);

            // Fallback: if no users doc exists after fetching, upsert one from the
            // Auth user object. Guards against getRedirectResult returning null
            // (e.g. redirect interrupted) while the session was already persisted.
            if (!state.userData) {
              try {
                await setDoc(doc(db, 'users', user.uid), {
                  displayName: user.displayName ?? null,
                  email: user.email ?? null,
                  photoURL: user.photoURL ?? null,
                  lastLogin: serverTimestamp()
                }, { merge: true });
                await dispatch('fetchUserData', user.uid);
                trackEvent('auth_users_doc_missing', { uid: user.uid });
              } catch (e) {
                console.error('[auth] fallback users doc upsert failed:', e);
              }
            }
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              resolve();
            }
          } else {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              resolve();
            }
          }
        });
      });

      await directoryFetch;

      if (getters.isLoggedIn && getters.myBreeders.length > 0 && router.currentRoute.value.path === '/') {
        const farm = getters.myBreeders[0];
        const path = farm.status === 'draft' ? `/get-listed/${farm.id}` : `/directory/${farm.id}`;
        router.push(path);
      }

      commit('SET_AUTH_READY', true);
    },

    async fetchUserData({ commit }: ActionContext<State, State>, uid: string) {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          commit('SET_USER_DATA', userDoc.data());
        }
      } catch (e) {
        console.error("Error fetching user data:", e);
      }
    },

    async fetchActiveClaims({ commit }: ActionContext<State, State>, uid: string) {
      try {
        const q = query(collection(db, 'claim_requests'), where("requesterUid", "==", uid));
        const snap = await getDocs(q);
        const slugs = snap.docs.map(doc => doc.data().businessSlug);
        commit('SET_ACTIVE_CLAIMS', slugs);
      } catch (e) {
        console.error("Error fetching claims:", e);
      }
    },

    async fetchClassifieds({ commit }: ActionContext<State, State>) {
      try {
        const q = query(
          collection(db, 'classifieds'),
          where('status', '==', 'active'),
          orderBy('created_at', 'desc')
        );
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Classified));
        commit('SET_CLASSIFIEDS', items);
      } catch (e) {
        console.error('Error fetching classifieds:', e);
      }
    },

    async fetchMyClassifieds({ commit }: ActionContext<State, State>, uid: string) {
      try {
        const liveQ = query(collection(db, 'classifieds'), where('owner_uid', '==', uid));
        const draftQ = query(collection(db, 'draft_classifieds'), where('owner_uid', '==', uid));
        const [liveSnap, draftSnap] = await Promise.all([getDocs(liveQ), getDocs(draftQ)]);
        const liveItems = liveSnap.docs.map(d => ({ id: d.id, ...d.data() } as Classified));
        const draftItems = draftSnap.docs.map(d => ({ id: d.id, ...d.data() } as DraftClassified));
        commit('SET_MY_CLASSIFIEDS', [...liveItems, ...draftItems]);
      } catch (e) {
        console.error('Error fetching my classifieds:', e);
      }
    },

    async createDraftClassified({ state, dispatch }: ActionContext<State, State>, payload: { category: ClassifiedCategory; location: string; title: string; description: string; price?: string; image_url?: string }) {
      if (!state.user) throw new Error('Must be logged in to post a classified.');
      const fullName = state.user.displayName || '';
      const parts = fullName.trim().split(' ');
      const displayName = parts.length <= 1
        ? (parts[0] || 'User')
        : `${parts[0]} ${(parts[parts.length - 1] || '').charAt(0).toUpperCase()}.`;
      const docData: Record<string, any> = {
        owner_uid: state.user.uid,
        display_name: displayName,
        location: payload.location,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        status: 'pending',
        created_at: serverTimestamp()
      };
      if (payload.price) {
        docData.price = payload.price;
      }
      if (payload.image_url) {
        docData.image_url = payload.image_url;
      }
      const ref = await addDoc(collection(db, 'draft_classifieds'), docData);
      await dispatch('fetchMyClassifieds', state.user.uid);
      return ref.id;
    },

    async fetchMyDrafts({ commit }: ActionContext<State, State>, uid: string) {
      try {
        const q = query(collection(db, 'draft_profiles'), where("draft_owner_uid", "==", uid));
        const snap = await getDocs(q);
        const drafts = snap.docs.map(doc => mapMemberToBreeder(doc.data() as FirestoreMember, doc.id));
        commit('SET_MY_DRAFTS', drafts);
      } catch (e) {
        console.error("Error fetching drafts:", e);
      }
    },

    async loginWithFacebook({ commit }: ActionContext<State, State>) {
      try {
        await signInWithRedirect(auth, facebookProvider);
      } catch (error: any) {
        console.error("[auth] login error:", error?.code ?? error);
        commit('PUSH_TOAST', {
          title: 'Authentication Error',
          message: `${error.message || 'Failed to start login flow.'} ${AUTH_TOAST_SUFFIX}`,
          variant: 'danger',
          duration: 30000
        });
      }
    },

    async logout({ commit }: ActionContext<State, State>) {
      await fullSignOut();
      commit('SET_USER', null);
      commit('SET_USER_DATA', null);
      commit('SET_ACTIVE_CLAIMS', []);
      commit('SET_MY_DRAFTS', []);
    },

    async fetchDirectory({ commit }: ActionContext<State, State>) {
      try {
        const membersRef = collection(db, 'directory_members');
        const q = query(
          membersRef, 
          where("account.status", "==", "published"), 
          orderBy("account.updatedAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const breeders = querySnapshot.docs.map(doc => mapMemberToBreeder(doc.data() as FirestoreMember, doc.id));
        commit('SET_BREEDERS', breeders);
        commit('SET_LAST_FETCH', Date.now());
      } catch (err) {
        console.error('Firestore sync error:', err);
      }
    },

    async fetchBreeder({ commit, state, getters }: ActionContext<State, State>, slug: string) {
      try {
        // 1. Try live Firestore
        const docRef = doc(db, 'directory_members', slug);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const breeder = mapMemberToBreeder(docSnap.data() as FirestoreMember, docSnap.id);
          commit('UPDATE_BREEDER', breeder);
          return breeder;
        }

        // 3. Try draft Firestore (Only if logged in)
        if (state.user) {
          const draftRef = doc(db, 'draft_profiles', slug);
          const draftSnap = await getDoc(draftRef);
          if (draftSnap.exists()) {
            const draftData = draftSnap.data() as FirestoreMember;
            const isOwner = (draftData as any).draft_owner_uid === state.user.uid;
            if (isOwner || getters.isAdmin) {
              return mapMemberToBreeder(draftData, draftSnap.id);
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching breeder [${slug}]:`, err);
      }
      return null;
    },

    async updateLocalEmail({ state, commit }: ActionContext<State, State>, email: string) {
      if (!state.user) throw new Error('Must be logged in.');
      const fn = httpsCallable(functions, 'setLocalEmail');
      const result = await fn({ email });
      const action = (result.data as any).action as string;
      if (!email) {
        const updated = { ...state.userData };
        delete updated.pendingLocalEmail;
        delete updated.localEmail;
        commit('SET_USER_DATA', updated);
      } else {
        commit('SET_USER_DATA', { ...state.userData, pendingLocalEmail: email });
      }
      return action;
    },

    async openPeerThread({ state }: ActionContext<State, State>, payload: { targetUid: string; senderFarmSlug?: string; classifiedId?: string }) {
      if (!state.user) throw new Error('Must be logged in.');
      const fn = httpsCallable(functions, 'initiatePeerThread');
      const result = await fn(payload);
      const { threadId } = result.data as { threadId: string };
      router.push(`/inbox/${threadId}`);
      return threadId;
    },

    async createDraftListing({ state, dispatch }: ActionContext<State, State>, payload: { businessName: string; town: string; memberType: string }) {
      if (!state.user) {
        throw new Error("Must be logged in to create a listing.");
      }

      const slug = generateSlug(payload.businessName);
      if (!slug) throw new Error("Invalid business name.");

      const liveDocRef = doc(db, 'directory_members', slug);
      const draftDocRef = doc(db, 'draft_profiles', slug);

      try {
        await runTransaction(db, async (transaction) => {
          const liveDoc = await transaction.get(liveDocRef);
          if (liveDoc.exists()) {
            throw new Error("A listing with this name already exists in the directory.");
          }

          const draftDoc = await transaction.get(draftDocRef);
          if (draftDoc.exists()) {
            throw new Error("A listing with this name is already pending approval.");
          }

          const draftPayload: any = {
            profile: {
              businessName: payload.businessName,
              town: payload.town,
              memberType: payload.memberType,
              contactEmail: (state.userData?.localEmail as string | undefined) || state.user!.email || '',
              website: ''
            },
            offerings: {
              description: '',
              searchTags: []
            },
            media: {
              logoUrl: null,
              galleryUrls: []
            },
            draft_owner_uid: state.user!.uid,
            updatedAt: serverTimestamp()
          };

          transaction.set(draftDocRef, draftPayload);
        });
        
        await dispatch('fetchMyDrafts', state.user.uid);
        return slug;
      } catch (e: any) {
        if (e.message.includes("already exists") || e.message.includes("pending approval")) {
          throw e;
        }
        throw new Error("Failed to create listing due to a system error. Please try again.");
      }
    }
  },

  getters: {
    allBreeders: (state: State) => state.breeders,
    isLoggedIn: (state: State) => !!state.user,
    isAdmin: (state: State) => state.userData?.isAdmin || false,
    ownedSlugs: (state: State) => {
      if (!state.user) return [];
      return state.breeders
        .filter(b => b.ownerUid === state.user?.uid)
        .map(b => b.id);
    },
    currentUser: (state: State) => state.user,
    authReady: (state: State) => state.authReady,
    
    userTier: (_state: State, getters: any): UserTier => {
      if (getters.isAdmin) return 'premium';
      const hasVerifiedFarm = getters.myBreeders.some((b: Breeder) => b.verified && b.status === 'published');
      return hasVerifiedFarm ? 'premium' : 'freemium';
    },

    activeClassifiedCount: (state: State) => {
      if (!state.user) return 0;
      return state.myClassifieds.filter(c => c.status === 'active' || c.status === 'pending').length;
    },

    canPostClassified: (_state: State, getters: any) => {
      if (getters.isAdmin) return true;
      const tier = getters.userTier as UserTier;
      const limit = TIER_LIMITS[tier];
      return getters.activeClassifiedCount < limit;
    },

    myBreeders: (state: State) => {
      if (!state.user) return [];
      
      // Combine live and drafts owned by me
      const live = state.breeders.filter(b => b.ownerUid === state.user?.uid);
      const drafts = state.myDrafts;
      
      const seenIds = new Set(live.map(l => l.id));
      const filteredDrafts = drafts.filter(d => !seenIds.has(d.id));
      
      return [...live, ...filteredDrafts];
    },

    suggestedClaim: (state: State) => {
      if (!state.user) return null;
      const oauthEmail = state.user.email?.toLowerCase();
      const localEmail = (state.userData?.localEmail as string | undefined)?.toLowerCase();

      return state.breeders.find(b => {
        const ce = b.contact_link?.toLowerCase();
        return !b.ownerUid && ce && (ce === oauthEmail || ce === localEmail);
      }) || null;
    },

    featuredBreeder: (state: State) => {
      const all = state.breeders;
      if (all.length === 0) return null;
      const trusted = all.filter(b => b.verified || b.founding_breeder);
      const pool = trusted.length > 0 ? trusted : all;
      const index = getWeekNumber() % pool.length;
      return pool[index];
    }
  }
});
