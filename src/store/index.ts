import { createStore } from 'vuex';
import type { Breeder, DirectoryData, ResponseError } from '../types';
import { loadFromCache, saveToCache, isCacheValid } from './cache';
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
      
      // 1. ATTEMPT RESTORE (If state is empty)
      if (state.breeders.length === 0) {
        const cached = loadFromCache();
        if (cached) {
          commit('SET_BREEDERS', cached.data);
          commit('SET_LAST_FETCH', cached.timestamp);
          console.log("Restored directory from local storage.");
        }
      }

      // 2. THROTTLE CHECK (Using the restored timestamp)
      if (state.breeders.length > 0 && isCacheValid(state.lastFetch)) {
        console.log("Cache is fresh. Skipping network fetch.");
        return;
      }

      // 3. FETCH NETWORK DATA
      try {
        console.log("Fetching fresh directory data...");
        const url = buildDataURL();
        const response = await fetch(url);
        const data: DirectoryData | ResponseError = await response.json();
        
        if ((data as ResponseError).error) { 
          console.error((data as ResponseError).error);
          return; 
        }
        
        let rawList: Breeder[] = (data as DirectoryData).directory_info || [];

        // 4. PROCESS & DECODE
        const freshList: Breeder[] = rawList.map((breeder: Breeder) => {
          // default category if unset
          breeder.category ||= 'breeder';

          // ... (Your existing decode logic for images/logos/links) ...
          // (Copy the mapping logic from previous step here)
           let images = [];
           let logo = null;

           if (breeder.image_cache_json) {
              try {
                 const cacheObj = JSON.parse(breeder.image_cache_json);
                 logo = cacheObj.logo;
                 images = cacheObj.images || [];
              } catch(e) {}
           }
           
           return {
             ...breeder,
             contact_link: decodeValue(breeder.contact_link),
             info_link: decodeValue(breeder.info_link),
             logo: logo ? decodeValue(logo) : (breeder.logo ? decodeValue(breeder.logo) : null),
             images: images.length > 0 ? images.map(decodeValue) : (Array.isArray(breeder.images) ? breeder.images.map(decodeValue) : [])
           } as Breeder;
        });
        
        // 5. COMMIT & SAVE
        commit('SET_BREEDERS', freshList);
        commit('SET_LAST_FETCH', new Date().getTime());
        
        saveToCache(freshList);
        console.log("Saved directory to cache.");
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