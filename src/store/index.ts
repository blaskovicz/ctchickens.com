import { createStore } from 'vuex';
import type { Breeder } from '../types';

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

function getClientID() {
  var clientID = "CLUCK";
  clientID += "_";
  clientID += "CLUCK";
  clientID += "_";
  clientID += "SECURE";
  clientID += "_";
  clientID += "2026";
  return clientID;
}

// 2. HELPER: Build the Obfuscated URL
const buildDataURL = () => {
  // A. OBFUSCATION: Break the URL to hide it from simple scrapers
  let partA = "https";
  partA += "://";
  partA += "script.";
  partA += "google.";
  partA += "com";
  const partB = "/macros/s/";
  
  const partID = "AKfycbzuZK_YDcXunzEDbrB84JXTfor48LDPnHx6oO7LFtd2fG6bY5PkNp7eBSNl9cmBWyuB"; 
  
  const partC = "/exec";
  const fullBase = `${partA}${partB}${partID}${partC}`;

  // B. AUTHENTICATION: The Handshake Key
  // Must match the API_SECRET in your Google Script (code.gs)
  let clientID = getClientID();
  const origin = window.location.origin;

  // C. Return the signed URL
  return `${fullBase}?origin=${origin}&clientID=${clientID}`;
};

const decodeValue = (encoded: any) => {
  if (typeof encoded !== 'string') return encoded;
  
  try {
    // Just simple native decoding
    return atob(encoded);
  } catch (e) {
    // If it fails (not base64), return original text
    return encoded;
  }
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
      const CACHE_KEY = 'ctchickens_directory_v1';
      const now = new Date().getTime();

      // 1. INSTANT LOAD: Check LocalStorage first
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // If our memory is empty, fill it immediately with disk cache
          if (state.breeders.length === 0) {
            console.log('Using cached breeder data');
            commit('SET_BREEDERS', parsed);
          }
        } catch (e) {
          console.error('Cache parse error for breeder data', e);
        }
      }

      // 2. THROTTLE: If we fetched from network < 1 min ago, stop here.
      if (state.breeders.length > 0 && (now - state.lastFetch) < 60000) {
        return; 
      }

      console.log('Fetching fresh breeder data');

      // 3. BACKGROUND FETCH: Get fresh data
      try {        
        // Note: The 'await' here will take 2-3 seconds, but the user 
        // already sees the cached data, so they don't notice!
        const response = await fetch(buildDataURL());
        const data = await response.json();

        if (data.error) {
          console.error('Store fetch error:', data.error);
          return;
        }

        const freshList = (data.directory_info || []).map((breeder: any) => ({
          ...breeder,
          contact_link: decodeValue(breeder.contact_link),
          info_link: decodeValue(breeder.info_link)
        }));
        
        // Update Store
        commit('SET_BREEDERS', freshList);
        commit('SET_LAST_FETCH', now);
        
        // Update LocalStorage for next time
        localStorage.setItem(CACHE_KEY, JSON.stringify(freshList));
        
      } catch (err) {
        console.error('Store fetch error:', err);
      }
    },
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