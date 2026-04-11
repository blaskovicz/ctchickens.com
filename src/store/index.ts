import { createStore } from 'vuex';
import type { ActionContext } from 'vuex';
import type { Breeder, FirestoreMember } from '../types';
import { db, auth, facebookProvider } from '../firebase';
import router from '../router';
import { 
  collection, getDocs, query, where, orderBy, doc, setDoc, getDoc, serverTimestamp, runTransaction 
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithRedirect,
  getRedirectResult,
  signOut
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { generateSlug } from '../composables/useBreederUtils';

interface State {
  breeders: Breeder[];
  myDrafts: Breeder[]; // List of drafts owned by the current user
  lastFetch: number;
  user: User | null; 
  userData: any | null; 
  activeClaims: string[]; // List of businessSlugs currently being claimed
  authReady: boolean;
  toasts: { message: string; title?: string; variant: string }[];
  showInquiryModal: { show: boolean; breeder?: Breeder };
}

const mapMemberToBreeder = (member: FirestoreMember, id: string): Breeder => {
  return {
    id,
    name: member.profile.businessName,
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
    async initAuth({ commit, dispatch, getters }: ActionContext<State, State>) {
      console.log("Auth: Initializing...");
      const url = window.location.href;
      const hasRedirectParams = url.includes('__firebase_request_key') || url.includes('code=') || url.includes('state=');
      
      try {
        // 1. Handle redirect result FIRST
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;

          await setDoc(doc(db, 'users', user.uid), {
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: serverTimestamp()
          }, { merge: true });
          
          await Promise.all([
            dispatch('fetchUserData', user.uid),
            dispatch('fetchActiveClaims', user.uid),
            dispatch('fetchMyDrafts', user.uid)
          ]);
        }
      } catch (error: any) {
        console.error("Auth: Redirect error detail:", error);
        commit('PUSH_TOAST', {
          title: 'Authentication Error',
          message: error.message || 'Login failed during redirect',
          variant: 'danger'
        });
      }

      // 2. Setup observer
      await new Promise<void>((resolve) => {
        let isResolved = false;
        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        }, 5000);

        onAuthStateChanged(auth, async (user) => {
          commit('SET_USER', user);
          
          if (user) {
            await Promise.all([
              dispatch('fetchUserData', user.uid),
              dispatch('fetchActiveClaims', user.uid),
              dispatch('fetchMyDrafts', user.uid)
            ]);
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              resolve();
            }
          } else if (!hasRedirectParams) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              resolve();
            }
          }
        });
      });

      // 3. Final synchronization
      try {
        await dispatch('fetchDirectory');
      } catch (e) {
        console.error("Auth: fetchDirectory failed", e);
      }
      
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
        commit('PUSH_TOAST', {
          title: 'Authentication Error',
          message: error.message || 'Failed to start login flow',
          variant: 'danger'
        });
      }
    },

    async logout({ commit }: ActionContext<State, State>) {
      await signOut(auth);
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
        // 1. Check local directory first
        const local = state.breeders.find(b => b.id === slug);
        if (local) return local;

        // 2. Try live Firestore
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
              contactEmail: state.user!.email || '',
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
      if (!state.user || !state.user.email) return null;
      const userEmail = state.user.email.toLowerCase();
      
      return state.breeders.find(b => {
        return b.contact_link?.toLowerCase() === userEmail && !b.ownerUid;
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
