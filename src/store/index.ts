import { createStore } from 'vuex';
import type { Breeder, FirestoreMember } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

interface State {
  breeders: Breeder[];
  lastFetch: number;
}

// Helper: Transform Firestore Member to Legacy Breeder Interface
const mapMemberToBreeder = (member: FirestoreMember): Breeder => {
  return {
    name: member.profile.businessName,
    location: member.profile.town,
    selling: member.offerings.description,
    category: member.profile.memberType,
    verified: member.account.isVerified,
    founding_breeder: member.account.foundingMember ? member.account.foundingMember : undefined,
    contact_link: member.profile.contactEmail,
    info_link: member.profile.website,
    updated: member.account.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    featured: false, // Will be calculated or added to schema later
    reviews: [], // Reviews handled in Phase 2/3
    logo: member.media.logoUrl,
    images: member.media.galleryUrls
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
  } as State,
  mutations: {
    SET_BREEDERS(state: State, payload: Breeder[]) {
      state.breeders = payload;
    },
    SET_LAST_FETCH(state: State, time: number) {
      state.lastFetch = time;
    }
  },
  actions: {
    async fetchDirectory({ commit }: { commit: any }) {
      try {
        console.log("Fetching directory from Firestore...");
        
        // Query only published members
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

        // Map to legacy Breeder interface for UI compatibility
        const breeders = members.map(mapMemberToBreeder);
        
        commit('SET_BREEDERS', breeders);
        commit('SET_LAST_FETCH', Date.now());
        
        console.log(`Successfully synced ${breeders.length} members.`);
      } catch (err) {
        console.error('Firestore sync error:', err);
      }
    }
  },
  getters: {
    allBreeders: (state: State) => state.breeders,
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
