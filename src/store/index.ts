import { createStore } from 'vuex';
import type { Breeder, FirestoreMember } from '../types';
import { db, auth, facebookProvider } from '../firebase';
import { 
  collection, getDocs, query, where, orderBy, doc, setDoc, getDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut
} from 'firebase/auth';
import type { User } from 'firebase/auth';

import { generateSlug } from '../composables/useBreederUtils';

interface State {
  breeders: Breeder[];
  lastFetch: number;
  user: User | null; 
  userData: any | null; 
  activeClaims: string[]; // List of businessSlugs currently being claimed
  authReady: boolean;
}

const mapMemberToBreeder = (member: FirestoreMember): Breeder => {
  return {
    name: member.profile.businessName,
    location: member.profile.town,
    selling: member.offerings.description,
    category: member.profile.memberType,
    verified: member.account.isVerified,
    founding_breeder: member.account.foundingMember, 
    contact_link: member.profile.contactEmail,
    info_link: member.profile.website,
    updated: member.account.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    featured: false, 
    reviews: [], 
    logo: member.media.logoUrl,
    images: member.media.galleryUrls,
    ownerUid: member.account.ownerUid,
    facebookUid: member.account.facebookUid
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
    lastFetch: 0,
    user: null,
    userData: null,
    activeClaims: [],
    authReady: false,
  } as State,

  mutations: {
    SET_BREEDERS(state: State, payload: Breeder[]) {
      state.breeders = payload;
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
    }
  },

  actions: {
    async initAuth({ commit, dispatch }) {
      return new Promise<void>((resolve) => {
        onAuthStateChanged(auth, async (user) => {
          commit('SET_USER', user);
          if (user) {
            await Promise.all([
              dispatch('fetchUserData', user.uid),
              dispatch('fetchActiveClaims', user.uid)
            ]);
          } else {
            commit('SET_USER_DATA', null);
            commit('SET_ACTIVE_CLAIMS', []);
          }
          commit('SET_AUTH_READY', true);
          resolve();
        });
      });
    },

    async fetchUserData({ commit }, uid: string) {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          commit('SET_USER_DATA', userDoc.data());
        }
      } catch (e) {
        console.error("Error fetching user data:", e);
      }
    },

    async fetchActiveClaims({ commit }, uid: string) {
      try {
        const q = query(collection(db, 'claim_requests'), where("requesterUid", "==", uid));
        const snap = await getDocs(q);
        const slugs = snap.docs.map(doc => doc.data().businessSlug);
        commit('SET_ACTIVE_CLAIMS', slugs);
      } catch (e) {
        console.error("Error fetching claims:", e);
      }
    },

    async loginWithFacebook({ commit, dispatch }) {
      try {
        const result = await signInWithPopup(auth, facebookProvider);
        const user = result.user;
        const facebookProfile = user.providerData.find(p => p.providerId === 'facebook.com');

        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          facebookUid: facebookProfile?.uid || null,
          lastLogin: serverTimestamp()
        }, { merge: true });

        await Promise.all([
          dispatch('fetchUserData', user.uid),
          dispatch('fetchActiveClaims', user.uid)
        ]);
        commit('SET_USER', user);
      } catch (error: any) {
        console.error("Facebook Login Error:", error.message);
        throw error;
      }
    },

    async logout({ commit }) {
      await signOut(auth);
      commit('SET_USER', null);
      commit('SET_USER_DATA', null);
      commit('SET_ACTIVE_CLAIMS', []);
    },

    async fetchDirectory({ commit }) {
      try {
        console.log("Fetching directory from Firestore...");
        const membersRef = collection(db, 'directory_members');
        const q = query(
          membersRef, 
          where("account.status", "==", "published"), 
          orderBy("account.updatedAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const members: FirestoreMember[] = [];
        querySnapshot.forEach((doc) => {
          members.push({ id: doc.id, ...doc.data() } as FirestoreMember);
        });
        const breeders = members.map(mapMemberToBreeder);
        commit('SET_BREEDERS', breeders);
        commit('SET_LAST_FETCH', Date.now());
      } catch (err) {
        console.error('Firestore sync error:', err);
      }
    }
  },

  getters: {
    allBreeders: (state: State) => state.breeders,
    isLoggedIn: (state: State) => !!state.user,
    isAdmin: (state: State) => state.userData?.isAdmin || false,
    currentUser: (state: State) => state.user,
    authReady: (state: State) => state.authReady,
    
    myBreeders: (state: State) => {
      if (!state.user) {
        console.log("MyBreeders: No user logged in.");
        return [];
      }
      console.log("MyBreeders: Checking for UID:", state.user.uid);
      const matched = state.breeders.filter(b => {
        if (b.ownerUid) {
          console.log(`Checking farm [${b.name}] with ownerUid [${b.ownerUid}]`);
        }
        return b.ownerUid === state.user?.uid;
      });
      console.log("MyBreeders: Found matches:", matched.length);
      return matched;
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
