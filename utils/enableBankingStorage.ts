import { EnableBankingConnection } from '../types';

export const PENDING_EB_CONNECTIONS_KEY = 'enableBankingPendingConnections';
export const ENABLE_BANKING_CONFIG_KEY = 'enableBankingConfig';

export interface EnableBankingConfig {
  countryCode: string;
  selectedBank?: string;
}

export const persistPendingConnection = (connection: EnableBankingConnection) => {
  if (typeof window === 'undefined') return;

  try {
    const existingRaw = sessionStorage.getItem(PENDING_EB_CONNECTIONS_KEY);
    const existing: EnableBankingConnection[] = existingRaw ? JSON.parse(existingRaw) : [];
    const updated = [...existing.filter(conn => conn.id !== connection.id), connection];
    sessionStorage.setItem(PENDING_EB_CONNECTIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Unable to persist pending Enable Banking connection', error);
  }
};

export const loadPendingConnection = (connectionId: string): EnableBankingConnection | null => {
  if (typeof window === 'undefined') return null;

  try {
    const existingRaw = sessionStorage.getItem(PENDING_EB_CONNECTIONS_KEY);
    const existing: EnableBankingConnection[] = existingRaw ? JSON.parse(existingRaw) : [];
    return existing.find(conn => conn.id === connectionId) || null;
  } catch (error) {
    console.warn('Unable to load pending Enable Banking connection', error);
    return null;
  }
};

export const removePendingConnection = (connectionId: string) => {
  if (typeof window === 'undefined') return;

  try {
    const existingRaw = sessionStorage.getItem(PENDING_EB_CONNECTIONS_KEY);
    const existing: EnableBankingConnection[] = existingRaw ? JSON.parse(existingRaw) : [];
    const updated = existing.filter(conn => conn.id !== connectionId);
    sessionStorage.setItem(PENDING_EB_CONNECTIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Unable to remove pending Enable Banking connection', error);
  }
};

export const persistEnableBankingConfig = (config: EnableBankingConfig) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ENABLE_BANKING_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn('Unable to persist Enable Banking configuration', error);
  }
};

export const loadEnableBankingConfig = (): EnableBankingConfig | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(ENABLE_BANKING_CONFIG_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      countryCode: parsed.countryCode || 'FI',
      selectedBank: parsed.selectedBank || '',
    };
  } catch (error) {
    console.warn('Unable to load Enable Banking configuration', error);
    return null;
  }
};
