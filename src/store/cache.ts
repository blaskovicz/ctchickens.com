import type { Breeder } from '../types';

const DATA_KEY = 'ctchickens_directory_v1';
const TIME_KEY = 'ctchickens_timestamp_v1';
const CACHE_DURATION = 5 * 60 * 1000; // 15 Minutes (this should line up with the app script cache duration)

export interface CacheResult {
  data: Breeder[];
  timestamp: number;
}

export const loadFromCache = (): CacheResult | null => {
  const cachedData = localStorage.getItem(DATA_KEY);
  const cachedTime = localStorage.getItem(TIME_KEY);

  if (!cachedData || !cachedTime) return null;

  try {
    return {
      data: JSON.parse(cachedData),
      timestamp: parseInt(cachedTime, 10)
    };
  } catch (e) {
    console.warn('Cache corrupted, clearing...', e);
    clearCache();
    return null;
  }
};

export const saveToCache = (data: Breeder[]) => {
  const now = new Date().getTime();
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    localStorage.setItem(TIME_KEY, now.toString());
  } catch (e) {
    console.error('Failed to save to localStorage (Quota exceeded?)', e);
  }
};

export const isCacheValid = (lastFetchTime: number): boolean => {
  const now = new Date().getTime();
  return (now - lastFetchTime) < CACHE_DURATION;
};

export const clearCache = () => {
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(TIME_KEY);
};