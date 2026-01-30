import { createStore } from 'vuex';
import type { DirectoryData, Breeder } from '../types';

interface State {
  breeders: Breeder[];
  lastFetch: number;
}

// Helper: Calculate Week Number (moved from component to here)
const getWeekNumber = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export default createStore({
  state: {
    breeders: [],
    lastFetch: 0 , // To track cache freshness
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
    async fetchDirectory({ commit, state }: { commit: any, state: State }) {
      // 1. CACHE CHECK: If we fetched less than 1 minute ago, don't fetch again.
      // This prevents spamming the server if you navigate between pages.
      const now = new Date().getTime();
      if (state.breeders.length > 0 && (now - state.lastFetch) < 60000) {
        return; 
      }

      try {
        // 2. FETCH with Cache Busting
        const response = await fetch(`/directory-info.json?t=${now}`);
        const data: DirectoryData = await response.json();
        
        commit('SET_BREEDERS', data.directory_info || []);
        commit('SET_LAST_FETCH', now);
      } catch (err) {
        console.error('Store fetch error:', err);
      }
    }
  },
  getters: {
    allBreeders: (state: State) => state.breeders,
    
    // 3. CENTRALIZED FEATURED LOGIC
    // We calculate the "Featured Breeder" here so all components see the same one.
    featuredBreeder: (state: State) => {
      const all = state.breeders;
      if (all.length === 0) return null;

      // Tier 1: Paid/Featured
      const paid = all.filter(b => b.featured === true);
      // Tier 2: Verified/Founding
      const trusted = all.filter(b => b.verified || b.founding_breeder);
      
      const pool = paid.length > 0 ? paid : trusted;
      
      if (pool.length === 0) return null;

      const index = getWeekNumber() % pool.length;
      return pool[index];
    }
  }
});