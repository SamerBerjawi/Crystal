import { EnableBankingConnection } from '../types';

export const PENDING_EB_CONNECTIONS_KEY = 'enableBankingPendingConnections';
export const ENABLE_BANKING_CONFIG_KEY = 'enableBankingConfig';

export interface EnableBankingConfig {
  applicationId: string;
  countryCode: string;
  selectedBank?: string;
}

export const persistPendingConnection = (connection: EnableBankingConnection) => {
  if (typeof window === 'undefined') return;

  try {
    const existingRaw = sessionStorage.getItem(PENDING_EB_CONNECTIONS_KEY);
    const existing: EnableBankingConnection[] = existingRaw ? JSON.parse(existingRaw) : [];
    const { clientCertificate: _key, ...withoutKey } = connection;
    const updated = [...existing.filter(conn => conn.id !== connection.id), withoutKey as EnableBankingConnection];
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
    // The private key is deliberately not part of the persisted configuration (it lives on the server).
    const { applicationId, countryCode, selectedBank } = config;
    window.localStorage.setItem(ENABLE_BANKING_CONFIG_KEY, JSON.stringify({ applicationId, countryCode, selectedBank }));
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
    if ('clientCertificate' in parsed) {
      // Older versions stored the private key here; remove it.
      delete parsed.clientCertificate;
      window.localStorage.setItem(ENABLE_BANKING_CONFIG_KEY, JSON.stringify(parsed));
    }

    return {
      applicationId: parsed.applicationId || '',
      countryCode: parsed.countryCode || 'FI',
      selectedBank: parsed.selectedBank || '',
    };
  } catch (error) {
    console.warn('Unable to load Enable Banking configuration', error);
    return null;
  }
};

/** Whether the server holds an Enable Banking key for this user (the key itself is never returned). */
export const fetchCredentialStatus = async (): Promise<{ configured: boolean; applicationId: string }> => {
  try {
    const res = await fetch('/api/enable-banking/credentials', { credentials: 'include' });
    if (!res.ok) return { configured: false, applicationId: '' };
    const body = await res.json();
    return { configured: Boolean(body.configured), applicationId: body.applicationId || '' };
  } catch {
    return { configured: false, applicationId: '' };
  }
};
