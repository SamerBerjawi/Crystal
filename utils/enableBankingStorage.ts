import { EnableBankingConnection } from '../types';

export const PENDING_EB_CONNECTIONS_KEY = 'enableBankingPendingConnections';
export const ENABLE_BANKING_CONFIG_KEY = 'enableBankingConfig';

export interface EnableBankingConfig {
  applicationId: string;
  countryCode: string;
  clientCertificate: string;
  selectedBank?: string;
}

const sanitizeLocalConnection = (conn: EnableBankingConnection): EnableBankingConnection => {
  const copy = { ...conn };
  if (copy.clientCertificate && copy.clientCertificate.includes('BEGIN PRIVATE KEY')) {
    copy.clientCertificate = '[CONFIGURED_ON_SERVER]';
  }
  return copy;
};

export const persistPendingConnection = (connection: EnableBankingConnection) => {
  if (typeof window === 'undefined') return;

  try {
    const sanitized = sanitizeLocalConnection(connection);
    const existingRaw = sessionStorage.getItem(PENDING_EB_CONNECTIONS_KEY);
    const existing: EnableBankingConnection[] = existingRaw ? JSON.parse(existingRaw) : [];
    const updated = [...existing.filter(conn => conn.id !== connection.id), sanitized];
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

export const loadAllPendingConnections = (): EnableBankingConnection[] => {
  if (typeof window === 'undefined') return [];

  try {
    const existingRaw = sessionStorage.getItem(PENDING_EB_CONNECTIONS_KEY);
    const existing: EnableBankingConnection[] = existingRaw ? JSON.parse(existingRaw) : [];
    return Array.isArray(existing) ? existing : [];
  } catch (error) {
    console.warn('Unable to load pending Enable Banking connections', error);
    return [];
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
    const sanitized = { ...config };
    if (sanitized.clientCertificate && sanitized.clientCertificate.includes('BEGIN PRIVATE KEY')) {
      sanitized.clientCertificate = '[CONFIGURED_ON_SERVER]';
    }
    window.localStorage.setItem(ENABLE_BANKING_CONFIG_KEY, JSON.stringify(sanitized));
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
      applicationId: parsed.applicationId || '',
      countryCode: parsed.countryCode || 'FI',
      clientCertificate: parsed.clientCertificate || '',
      selectedBank: parsed.selectedBank || '',
    };
  } catch (error) {
    console.warn('Unable to load Enable Banking configuration', error);
    return null;
  }
};
