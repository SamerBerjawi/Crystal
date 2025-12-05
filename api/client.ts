import { FinancialData } from '../types';
import { PendingChange, addPendingChange, cacheFinancialData, readCachedFinancialData } from '../db';

const API_BASE = '/api';

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // no-op
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // no-op
    }
  },
};

export const AUTH_TOKEN_KEY = 'crystal_auth_token';

export const getStoredToken = (): string | null => safeLocalStorage.getItem(AUTH_TOKEN_KEY);

export const persistToken = (token: string | null) => {
  if (token) {
    safeLocalStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    safeLocalStorage.removeItem(AUTH_TOKEN_KEY);
  }
};

const shouldUseNetwork = () => typeof navigator === 'undefined' || navigator.onLine;

const sendFinancialData = async (
  data: FinancialData,
  token: string,
  options?: { keepalive?: boolean; suppressErrors?: boolean }
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
      keepalive: options?.keepalive,
    });

    if (!response.ok) {
      if (!options?.suppressErrors) {
        const message = await response.text().catch(() => '');
        console.error('Failed to save data:', message || response.statusText);
      }
      return false;
    }

    return true;
  } catch (error) {
    if (!options?.suppressErrors) {
      console.error('Failed to save data:', error);
    }
    return false;
  }
};

const queueFinancialChange = async (
  data: FinancialData,
  token: string | null
) =>
  addPendingChange({
    entityType: 'financialData',
    operation: 'update',
    payload: data,
    createdAt: Date.now(),
    authToken: token,
  });

export const fetchFinancialData = async (token: string | null): Promise<FinancialData | null> => {
  if (!token || !shouldUseNetwork()) {
    return readCachedFinancialData();
  }

  try {
    const response = await fetch(`${API_BASE}/data`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const cached = await readCachedFinancialData();
      return cached;
    }

    const data = (await response.json()) as FinancialData;
    await cacheFinancialData(data);
    return data;
  } catch (error) {
    console.warn('Network fetch failed, using cached data if available.', error);
    return readCachedFinancialData();
  }
};

export const saveFinancialData = async (
  data: FinancialData,
  token: string | null,
  options?: { keepalive?: boolean; suppressErrors?: boolean; enqueueOnFail?: boolean }
): Promise<boolean> => {
  await cacheFinancialData(data);

  if (!token || !shouldUseNetwork()) {
    await queueFinancialChange(data, token ?? null);
    return false;
  }

  const succeeded = await sendFinancialData(data, token, options);
  if (!succeeded && options?.enqueueOnFail !== false) {
    await queueFinancialChange(data, token);
  }
  return succeeded;
};

export const replayPendingFinancialChange = async (
  change: PendingChange,
  tokenOverride?: string | null
): Promise<boolean> => {
  const authToken = tokenOverride ?? change.authToken ?? getStoredToken();
  if (!authToken) {
    return false;
  }
  const success = await sendFinancialData(change.payload as FinancialData, authToken, { suppressErrors: true });
  if (success) {
    await cacheFinancialData(change.payload as FinancialData);
  }
  return success;
};
