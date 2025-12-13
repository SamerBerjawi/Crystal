import { v4 as uuidv4 } from 'uuid';
import {
  Account,
  AppPreferences,
  EnableBankingAspsp,
  EnableBankingSessionAccount,
  Transaction,
} from '../types';
import { toLocalISOString } from '../utils';
import { KJUR } from 'jsrsasign';

export const ENABLE_BANKING_REDIRECT_PATH = '/enable_banking_items/callback';

const getDefaultRedirectUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${ENABLE_BANKING_REDIRECT_PATH}`;
  }

  return `https://crystal.samxr.com${ENABLE_BANKING_REDIRECT_PATH}`;
};

const textEncoder = new TextEncoder();

const resolveCrypto = (): Crypto | undefined => {
  if (typeof globalThis !== 'undefined') {
    const cryptoImpl = (globalThis as any).crypto || (globalThis as any).msCrypto;
    if (cryptoImpl?.subtle) {
      return cryptoImpl as Crypto;
    }
  }

  return undefined;
};

const base64UrlEncode = (value: string | ArrayBuffer): string => {
  const bytes = typeof value === 'string' ? textEncoder.encode(value) : new Uint8Array(value);
  let binary = '';
  bytes.forEach(b => {
    binary += String.fromCharCode(b);
  });

  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const pemToArrayBuffer = (pem: string): ArrayBuffer => {
  const normalized = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\r?\n|\s+/g, '');

  const binaryString = atob(normalized);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const createEnableBankingJwt = async (preferences: AppPreferences) => {
  if (!isEnableBankingConfigured(preferences)) {
    throw new Error('Enable Banking credentials are incomplete');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    typ: 'JWT',
    alg: 'RS256',
    kid: preferences.enableBankingApplicationId,
  };
  const payload = {
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat: now,
    exp: now + 3600,
  };

  const cryptoImpl = resolveCrypto();
  if (cryptoImpl?.subtle) {
    const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;

    const keyBuffer = pemToArrayBuffer(preferences.enableBankingClientCertificate || '');
    const cryptoKey = await cryptoImpl.subtle.importKey(
      'pkcs8',
      keyBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await cryptoImpl.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, textEncoder.encode(unsigned));
    const jwt = `${unsigned}.${base64UrlEncode(signature)}`;
    return jwt;
  }

  const jwt = KJUR.jws.JWS.sign(
    'RS256',
    JSON.stringify(header),
    JSON.stringify(payload),
    preferences.enableBankingClientCertificate || '',
  );
  return jwt;
};

export const fetchEnableBankingAspsps = async (
  preferences: AppPreferences,
  countryCode?: string,
): Promise<EnableBankingAspsp[]> => {
  const country = (countryCode || preferences.enableBankingCountryCode || '').trim();
  if (!country) throw new Error('Country code is required to fetch ASPSPs');

  const jwt = await createEnableBankingJwt(preferences);
  const response = await fetch(`https://api.enablebanking.com/aspsps?country=${encodeURIComponent(country)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to load banks (${response.status})`);
  }

  const data = await response.json();
  return (data?.aspsps || []) as EnableBankingAspsp[];
};

export const startEnableBankingAuthorization = async (
  preferences: AppPreferences,
  aspspName: string,
  countryCode: string,
  redirectUrl?: string,
) => {
  const jwt = await createEnableBankingJwt(preferences);
  const state = uuidv4();
  const redirectTarget = redirectUrl || getDefaultRedirectUrl();
  const body = {
    access: {
      valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    aspsp: {
      name: aspspName,
      country: countryCode,
    },
    state,
    redirect_url: redirectTarget,
    psu_type: 'personal',
  };

  const response = await fetch('https://api.enablebanking.com/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('Failed to start authorization');
  }

  const data = await response.json();
  return { url: data.url as string, authorizationId: data.authorization_id as string, state };
};

export const exchangeEnableBankingCode = async (
  preferences: AppPreferences,
  code: string,
): Promise<{ sessionId: string; accounts: EnableBankingSessionAccount[] }> => {
  const jwt = await createEnableBankingJwt(preferences);
  const response = await fetch('https://api.enablebanking.com/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error('Failed to authorize session with the provided code');
  }

  const data = await response.json();
  const accounts: EnableBankingSessionAccount[] = (data?.accounts || []).map((acc: any) => ({
    uid: acc.uid,
    name: acc.name,
    account_id: acc.account_id,
    currency: acc.currency,
  }));

  return { sessionId: data.session_id, accounts };
};

export const isEnableBankingConfigured = (preferences: AppPreferences) => {
  return Boolean(
    preferences.enableBankingCountryCode &&
    preferences.enableBankingApplicationId &&
    preferences.enableBankingClientCertificate
  );
};

export const deriveSyncFromDate = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
};

export const buildEnableBankingSync = (account: Account) => {
  const today = toLocalISOString(new Date());
  const amount = Math.round((Math.random() * 200 - 100) * 100) / 100; // -100..100
  const transaction: Transaction = {
    id: uuidv4(),
    accountId: account.id,
    date: today,
    description: 'Enable Banking sync',
    merchant: account.financialInstitution || account.name,
    amount,
    category: 'Bank Sync',
    type: amount >= 0 ? 'income' : 'expense',
    currency: account.currency,
  };

  const updatedBalance = account.balance + amount;

  return {
    updatedBalance,
    transactions: [transaction],
  };
};
