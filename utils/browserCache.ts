import { FinancialData } from '../types';

const DB_NAME = 'crystal_dev_db';
const DB_VERSION = 1;
const STORE_NAME = 'dev_cache';
const RECORD_KEY = 'financial_data_latest';
export const DEV_STORAGE_KEY = 'crystal_dev_financial_data_cache';
export const DEV_MODE_ACTIVE_KEY = 'crystal_dev_mode_active';

/**
 * Opens or initializes the IndexedDB database for dev caching.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

/**
 * Persists financial data to both IndexedDB and localStorage (with safe quota fallback).
 */
export async function saveDevCache(data: FinancialData): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Save flag indicating dev mode session is active
  try {
    window.localStorage.setItem(DEV_MODE_ACTIVE_KEY, 'true');
  } catch {}

  // 2. Save in localStorage (fast sync read on page refresh)
  try {
    window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[Dev Cache] LocalStorage quota exceeded, relying on IndexedDB:', error);
  }

  // 3. Save in IndexedDB (robust, handles large payloads beyond 5MB)
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Dev Cache] IndexedDB write failed:', err);
  }
}

/**
 * Loads financial data from IndexedDB or localStorage.
 */
export async function loadDevCache(): Promise<FinancialData | null> {
  if (typeof window === 'undefined') return null;

  // 1. Try IndexedDB first (source of truth for complete snapshots)
  try {
    const db = await openDB();
    const data = await new Promise<FinancialData | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);
      req.onsuccess = () => resolve((req.result as FinancialData) || null);
      req.onerror = () => resolve(null);
    });

    if (data) {
      return data;
    }
  } catch (err) {
    console.warn('[Dev Cache] IndexedDB read failed, trying localStorage:', err);
  }

  // 2. Fallback to localStorage
  try {
    const raw = window.localStorage.getItem(DEV_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as FinancialData;
      }
    }
  } catch (err) {
    console.warn('[Dev Cache] LocalStorage read failed:', err);
  }

  return null;
}

/**
 * Clears the dev browser cache across IndexedDB and localStorage.
 */
export async function clearDevCache(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(DEV_STORAGE_KEY);
    window.localStorage.removeItem(DEV_MODE_ACTIVE_KEY);
  } catch {}

  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}
