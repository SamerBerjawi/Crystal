import { FinancialData } from './types';

export interface PendingChange {
  id?: number;
  entityType: string;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  createdAt: number;
  authToken?: string | null;
}

interface FinancialDataRecord {
  id: string;
  data: FinancialData;
  updatedAt: number;
}

const DB_NAME = 'crystal-db';
const DB_VERSION = 1;
const FINANCIAL_DATA_KEY = 'primary';

let dbPromise: Promise<IDBDatabase> | null = null;

const promisifyRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });

const awaitTransaction = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });

const getDatabase = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(DB_NAME, DB_VERSION);
      openRequest.onupgradeneeded = () => {
        const db = openRequest.result;
        if (!db.objectStoreNames.contains('financialData')) {
          db.createObjectStore('financialData');
        }
        if (!db.objectStoreNames.contains('pendingChanges')) {
          const pending = db.createObjectStore('pendingChanges', { keyPath: 'id', autoIncrement: true });
          pending.createIndex('by-createdAt', 'createdAt');
        }
      };
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error || new Error('Failed to open IndexedDB'));
    });
  }
  return dbPromise;
};

export const cacheFinancialData = async (data: FinancialData) => {
  const db = await getDatabase();
  const tx = db.transaction('financialData', 'readwrite');
  const store = tx.objectStore('financialData');
  store.put({ id: FINANCIAL_DATA_KEY, data, updatedAt: Date.now() } satisfies FinancialDataRecord, FINANCIAL_DATA_KEY);
  await awaitTransaction(tx);
};

export const readCachedFinancialData = async (): Promise<FinancialData | null> => {
  const db = await getDatabase();
  const tx = db.transaction('financialData', 'readonly');
  const store = tx.objectStore('financialData');
  const record = await promisifyRequest(store.get(FINANCIAL_DATA_KEY));
  await awaitTransaction(tx);
  return (record as FinancialDataRecord | undefined)?.data ?? null;
};

export const addPendingChange = async (change: Omit<PendingChange, 'id'>): Promise<number> => {
  const db = await getDatabase();
  const tx = db.transaction('pendingChanges', 'readwrite');
  const store = tx.objectStore('pendingChanges');
  const id = await promisifyRequest(store.add(change));
  await awaitTransaction(tx);
  return id as unknown as number;
};

export const getPendingChanges = async (): Promise<PendingChange[]> => {
  const db = await getDatabase();
  const tx = db.transaction('pendingChanges', 'readonly');
  const store = tx.objectStore('pendingChanges');
  const index = store.index('by-createdAt');
  const results = await promisifyRequest(index.getAll());
  await awaitTransaction(tx);
  return results as PendingChange[];
};

export const removePendingChange = async (id: number) => {
  const db = await getDatabase();
  const tx = db.transaction('pendingChanges', 'readwrite');
  const store = tx.objectStore('pendingChanges');
  store.delete(id);
  await awaitTransaction(tx);
};

export const clearPendingChanges = async () => {
  const db = await getDatabase();
  const tx = db.transaction('pendingChanges', 'readwrite');
  tx.objectStore('pendingChanges').clear();
  await awaitTransaction(tx);
};
