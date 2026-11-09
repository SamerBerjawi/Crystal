import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { FinancialData } from '../types';
import { toLocalDateTimeString } from '../utils';
import { useDebounce } from './useDebounce';
import { computeArrayDelta, threeWayMerge, type EntityDelta } from '../utils/threeWayMerge';
import { saveDevCache } from '../utils/browserCache';

const DELTA_ELIGIBLE_KEYS: (keyof FinancialData)[] = ['transactions', 'investmentTransactions'];

export const MATERIAL_DATA_ARRAY_KEYS: (keyof FinancialData)[] = [
  'accounts',
  'transactions',
  'investmentTransactions',
  'recurringTransactions',
  'recurringTransactionOverrides',
  'financialGoals',
  'budgets',
  'tasks',
  'warrants',
  'memberships',
  'importExportHistory',
  'billsAndPayments',
  'invoices',
  'tags',
  'predictions',
  'enableBankingConnections',
  'incomeCategories',
  'expenseCategories',
  'accountOrder',
  'taskOrder',
];

export const MATERIAL_DATA_OBJECT_KEYS: (keyof FinancialData)[] = [
  'loanPaymentOverrides',
  'manualWarrantPrices',
  'priceHistory',
  'userStats',
  'preferences',
];

/**
 * Slices of FinancialData the app persists. A slice is "dirty" when its current value is no longer the
 * same object as the one last loaded from / confirmed saved to the server (see savedSlicesRef).
 */
export const PERSISTED_SLICE_KEYS = [
  'accounts', 'transactions', 'investmentTransactions', 'recurringTransactions', 'recurringTransactionOverrides',
  'loanPaymentOverrides', 'financialGoals', 'goalOrder', 'budgets', 'tasks', 'warrants', 'memberships',
  'importExportHistory', 'incomeCategories', 'expenseCategories', 'preferences', 'billsAndPayments',
  'accountOrder', 'taskOrder', 'tags', 'manualWarrantPrices', 'priceHistory', 'invoices', 'userStats',
  'predictions', 'enableBankingConnections',
] as const satisfies readonly (keyof FinancialData)[];

/** Largest body a browser will send in a `keepalive` request (64 KiB), minus headroom. */
const KEEPALIVE_MAX_BYTES = 60_000;

export const hasMaterialData = (data: Partial<FinancialData> | null | undefined) => {
  if (!data) return false;

  const hasArrays = MATERIAL_DATA_ARRAY_KEYS.some(key => {
    const value = data[key];
    return Array.isArray(value) && value.length > 0;
  });

  if (hasArrays) return true;

  const hasMaterialObjects = MATERIAL_DATA_OBJECT_KEYS.some(key => {
    const value = data[key];
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
  });

  if (hasMaterialObjects) return true;

  return !!(data.preferences && data.preferences.dashboardLayouts && Object.keys(data.preferences.dashboardLayouts).length > 0);
};

type SaveOutcome = { ok: boolean; status?: number; currentUpdatedAt?: string; isConflict?: boolean };

interface UseFinancialPersistenceParams {
  isAuthenticated: boolean;
  isDemoMode: boolean;
  isDataLoaded: boolean;
  isDevEnvironment: boolean;
  dataToSave: FinancialData;
  authorizedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  loadAllFinancialData: (data: FinancialData | null, options?: { skipNextSave?: boolean }) => void;
  latestDataRef: React.MutableRefObject<FinancialData>;
  lastUpdatedAtRef: React.MutableRefObject<string | null>;
  restoreInProgressRef: React.MutableRefObject<boolean>;
  allowEmptySaveRef: React.MutableRefObject<boolean>;
  savedSlicesRef: React.MutableRefObject<Partial<Record<keyof FinancialData, unknown>>>;
  baselinePendingRef: React.MutableRefObject<boolean>;
  loadGeneration: number;
}

export function useFinancialPersistence({
  isAuthenticated,
  isDemoMode,
  isDataLoaded,
  isDevEnvironment,
  dataToSave,
  authorizedFetch,
  loadAllFinancialData,
  latestDataRef,
  lastUpdatedAtRef,
  restoreInProgressRef,
  allowEmptySaveRef,
  savedSlicesRef,
  baselinePendingRef,
  loadGeneration,
}: UseFinancialPersistenceParams) {
  const saveInFlightRef = useRef(false);
  const saveAgainRef = useRef(false);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const lastSaveFailureRef = useRef<{ ok: boolean; status?: number } | null>(null);
  const retryDelayRef = useRef(5000);
  const [dirtySignal, setDirtySignal] = useState(0);
  const debouncedDirtySignal = useDebounce(dirtySignal, 900);
  const mergedFromOtherDeviceRef = useRef(false);
  const mergedSlicesRef = useRef<Partial<FinancialData> | null>(null);

  const getDirtyKeys = useCallback(
    (data: FinancialData) => PERSISTED_SLICE_KEYS.filter(key => data[key] !== savedSlicesRef.current[key]),
    [savedSlicesRef],
  );

  const markSliceDirty = useCallback((_slice?: keyof FinancialData) => {
    if (restoreInProgressRef.current) return;
    setDirtySignal(signal => signal + 1);
  }, [restoreInProgressRef]);

  const postData = useCallback(
    async (payload: Record<string, unknown>, options?: { keepalive?: boolean; suppressErrors?: boolean }): Promise<SaveOutcome> => {
      if (!isAuthenticated || isDemoMode) return { ok: false };
      try {
        const response = await authorizedFetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: options?.keepalive,
        });
        if (response.status === 423 && !options?.keepalive) window.location.reload();
        if (response.ok) return { ok: true, status: response.status };
        const body = await response.json().catch(() => ({} as any));
        return {
          ok: false,
          status: response.status,
          currentUpdatedAt: typeof body?.currentUpdatedAt === 'string' ? body.currentUpdatedAt : undefined,
          isConflict: response.status === 409 && /data conflict/i.test(String(body?.message || '')),
        };
      } catch {
        return { ok: false };
      }
    }, [authorizedFetch, isAuthenticated, isDemoMode]
  );

  const reportSaveSuccess = useCallback(() => { toast.dismiss('save-status'); }, []);
  const reportSaveFailure = useCallback((outcome: SaveOutcome, suppress?: boolean) => {
    if (suppress) return;
    if (outcome.status === 401 || outcome.status === 403) {
      toast.error('Your session has expired', {
        id: 'save-status', duration: Infinity,
        description: 'Your latest changes are not saved. Sign in again and repeat them.',
      });
    } else if (outcome.status === 409) {
      toast.error("Your changes couldn't be saved", {
        id: 'save-status', duration: Infinity,
        description: 'Newer data exists on the server. Reload the page to continue with the latest version.',
      });
    } else {
      toast.error('Changes not saved', {
        id: 'save-status', duration: Infinity,
        description: (typeof navigator !== 'undefined' && navigator.onLine === false)
          ? "You're offline. Your changes will be saved when you reconnect."
          : "The server couldn't be reached. Retrying…",
      });
    }
  }, []);

  const sendWithConflictRetry = useCallback(
    async (
      mode: 'partial' | 'full',
      data: Partial<FinancialData>,
      options?: { keepalive?: boolean; suppressErrors?: boolean; allowEmpty?: boolean },
    ): Promise<boolean> => {
      const build = (slices: Partial<FinancialData>, previousUpdatedAt: string | null, useDeltas = true) => {
        const now = toLocalDateTimeString(new Date());
        if (mode === 'partial') {
          const fullSlices: Partial<FinancialData> = { ...slices };
          const deltas: Record<string, EntityDelta> = {};
          if (useDeltas) {
            for (const key of DELTA_ELIGIBLE_KEYS) {
              if (!(key in fullSlices)) continue;
              const delta = computeArrayDelta(
                savedSlicesRef.current[key] as { id: string }[] | undefined,
                fullSlices[key] as { id: string }[] | undefined,
              );
              if (delta) {
                deltas[key] = delta;
                delete fullSlices[key];
              }
            }
          }
          const payload: Record<string, unknown> = {
            partial: true,
            data: fullSlices,
            ...(Object.keys(deltas).length > 0 ? { deltas } : {}),
            lastUpdatedAt: now,
            previousUpdatedAt,
          };
          return { now, payload };
        }
        const payload = { ...slices, lastUpdatedAt: now, previousUpdatedAt, ...(options?.allowEmpty ? { allowEmpty: true } : {}) };
        return { now, payload: payload as Record<string, unknown> };
      };

      let { now, payload } = build(data, lastUpdatedAtRef.current, true);
      let outcome = await postData(payload, options);

      if (!outcome.ok && outcome.isConflict && outcome.currentUpdatedAt) {
        let merged: Partial<FinancialData> = data;
        try {
          const response = await authorizedFetch('/api/data');
          if (response.ok) {
            const serverCopy = await response.json() as Record<string, unknown>;
            merged = { ...data };
            for (const key of PERSISTED_SLICE_KEYS) {
              if (!(key in data)) continue;
              (merged as any)[key] = threeWayMerge(savedSlicesRef.current[key], (data as any)[key], serverCopy[key]);
            }
          }
        } catch { /* fall back to sending this device's slices unchanged */ }
        ({ now, payload } = build(merged, outcome.currentUpdatedAt, false));
        outcome = await postData(payload, options);
        if (outcome.ok) {
          mergedFromOtherDeviceRef.current = true;
          mergedSlicesRef.current = merged;
        }
      }

      if (outcome.ok) {
        lastUpdatedAtRef.current = now;
        reportSaveSuccess();
      } else {
        lastSaveFailureRef.current = outcome;
        reportSaveFailure(outcome, options?.suppressErrors);
      }
      return outcome.ok;
    }, [postData, authorizedFetch, reportSaveSuccess, reportSaveFailure, lastUpdatedAtRef, savedSlicesRef]
  );

  const saveData = useCallback(
    async (data: FinancialData, options?: { keepalive?: boolean; suppressErrors?: boolean; allowEmpty?: boolean }): Promise<boolean> => {
      if (!options?.allowEmpty && !hasMaterialData(data)) {
        console.warn('Skipping auto-save of empty data payload to prevent potential data loss.');
        return false;
      }
      return sendWithConflictRetry('full', data, options);
    }, [sendWithConflictRetry]
  );

  const savePartialData = useCallback(
    async (data: Partial<FinancialData>, options?: { keepalive?: boolean; suppressErrors?: boolean }): Promise<boolean> => {
      return sendWithConflictRetry('partial', data, options);
    }, [sendWithConflictRetry]
  );

  const savePartialDataWithRetry = useCallback(
    async (data: Partial<FinancialData>, options?: { attempts?: number }): Promise<boolean> => {
      const maxAttempts = Math.max(1, options?.attempts ?? 3);
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const succeeded = await savePartialData(data);
        if (succeeded) return true;
        if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
      return false;
    }, [savePartialData]
  );

  useEffect(() => {
    latestDataRef.current = dataToSave;
    if (!(isDevEnvironment && isDataLoaded && isDemoMode && !isAuthenticated && hasMaterialData(dataToSave))) return;
    const timer = setTimeout(() => { void saveDevCache(dataToSave); }, 1500);
    return () => clearTimeout(timer);
  }, [dataToSave, isDevEnvironment, isDataLoaded, isDemoMode, isAuthenticated, latestDataRef]);

  const refreshFromServer = useCallback(async () => {
    if (getDirtyKeys(latestDataRef.current).length > 0) return;
    try {
      const response = await authorizedFetch('/api/data');
      if (!response.ok) return;
      const serverData = await response.json() as FinancialData;
      if (getDirtyKeys(latestDataRef.current).length > 0) return;
      loadAllFinancialData(serverData);
      toast.info('Synced with changes from another device');
    } catch { /* the next successful save will reconcile */ }
  }, [authorizedFetch, getDirtyKeys, latestDataRef, loadAllFinancialData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setDirtySignal(signal => signal + 1);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;
    if (baselinePendingRef.current) {
      const baseline: Partial<Record<keyof FinancialData, unknown>> = {};
      for (const key of PERSISTED_SLICE_KEYS) baseline[key] = dataToSave[key];
      savedSlicesRef.current = baseline;
      baselinePendingRef.current = false;
      setSyncStatus('saved');
      return;
    }
    if (getDirtyKeys(dataToSave).length > 0) {
      setSyncStatus('unsaved');
      setDirtySignal(signal => signal + 1);
    }
  }, [dataToSave, loadGeneration, isDataLoaded, getDirtyKeys, baselinePendingRef, savedSlicesRef]);

  useEffect(() => {
    if (!isDataLoaded || !isAuthenticated || isDemoMode || restoreInProgressRef.current) return;
    if (baselinePendingRef.current) return;

    const persistDirtySlices = async () => {
      if (saveInFlightRef.current) { saveAgainRef.current = true; return; }

      const currentData = latestDataRef.current;
      const dirtyKeys = getDirtyKeys(currentData);
      if (dirtyKeys.length === 0) {
        setSyncStatus('saved');
        return;
      }

      const allowEmpty = allowEmptySaveRef.current;
      if (!allowEmpty && !hasMaterialData(currentData)) {
        for (const key of dirtyKeys) savedSlicesRef.current[key] = currentData[key];
        setSyncStatus('saved');
        return;
      }

      saveInFlightRef.current = true;
      setSyncStatus('saving');
      let succeeded = false;
      try {
        if (allowEmpty || dirtyKeys.length >= PERSISTED_SLICE_KEYS.length) {
          succeeded = await saveData(currentData, { allowEmpty });
        } else {
          const partialPayload: Partial<FinancialData> = {};
          for (const key of dirtyKeys) (partialPayload as any)[key] = currentData[key];
          succeeded = await savePartialData(partialPayload);
        }
      } finally {
        saveInFlightRef.current = false;
      }

      if (succeeded) {
        for (const key of dirtyKeys) {
          savedSlicesRef.current[key] = (mergedSlicesRef.current && key in mergedSlicesRef.current)
            ? (mergedSlicesRef.current as any)[key]
            : currentData[key];
        }
        mergedSlicesRef.current = null;
        if (allowEmpty) allowEmptySaveRef.current = false;
        retryDelayRef.current = 5000;
        if (getDirtyKeys(latestDataRef.current).length === 0) {
          setSyncStatus('saved');
        }
        if (mergedFromOtherDeviceRef.current) {
          mergedFromOtherDeviceRef.current = false;
          await refreshFromServer();
        }
      } else {
        setSyncStatus('unsaved');
        const status = lastSaveFailureRef.current?.status;
        if (status !== 401 && status !== 403 && status !== 409) {
          const delay = retryDelayRef.current;
          retryDelayRef.current = Math.min(delay * 2, 30_000);
          setTimeout(() => setDirtySignal(signal => signal + 1), delay);
        }
      }
      if (succeeded && (saveAgainRef.current || getDirtyKeys(latestDataRef.current).length > 0)) {
        saveAgainRef.current = false;
        setDirtySignal(signal => signal + 1);
      }
    };
    void persistDirtySlices();
  }, [debouncedDirtySignal, isAuthenticated, isDataLoaded, isDemoMode, saveData, savePartialData, getDirtyKeys, refreshFromServer, allowEmptySaveRef, baselinePendingRef, latestDataRef, restoreInProgressRef, savedSlicesRef]);

  useEffect(() => {
    if (!isAuthenticated || isDemoMode || typeof window === 'undefined') return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDataLoaded || baselinePendingRef.current || restoreInProgressRef.current) return;
      const currentData = latestDataRef.current;
      const dirtyKeys = getDirtyKeys(currentData);
      if (dirtyKeys.length === 0) return;
      if (!allowEmptySaveRef.current && !hasMaterialData(currentData)) return;

      const partialPayload: Partial<FinancialData> = {};
      const unloadDeltas: Record<string, EntityDelta> = {};
      for (const key of dirtyKeys) {
        if (DELTA_ELIGIBLE_KEYS.includes(key)) {
          const delta = computeArrayDelta(
            savedSlicesRef.current[key] as { id: string }[] | undefined,
            currentData[key] as { id: string }[] | undefined,
          );
          if (delta) {
            unloadDeltas[key] = delta;
            continue;
          }
        }
        (partialPayload as any)[key] = currentData[key];
      }
      const estimatedBytes = JSON.stringify({ data: partialPayload, deltas: unloadDeltas }).length;
      if (estimatedBytes <= KEEPALIVE_MAX_BYTES) {
        const fullDirtyPayload: Partial<FinancialData> = {};
        for (const key of dirtyKeys) (fullDirtyPayload as any)[key] = currentData[key];
        void savePartialData(fullDirtyPayload, { keepalive: true, suppressErrors: true });
      } else {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAuthenticated, isDataLoaded, isDemoMode, savePartialData, getDirtyKeys, allowEmptySaveRef, baselinePendingRef, latestDataRef, restoreInProgressRef]);

  return {
    syncStatus,
    setDirtySignal,
    markSliceDirty,
    getDirtyKeys,
    saveData,
    savePartialData,
    savePartialDataWithRetry,
  };
}
