
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from './middleware';
import { db } from './database';
import { derivePsuId, sanitizeAuthMethod, sanitizeCredentials } from './ebAuthOptions';
import { EnableBankingError, RATE_LIMIT_RETRY_SECONDS, buildPsuHeaders, parseErrorCode, parseRetryAfter, publicMessageFor, requiresReauthorization, sanitizeRequiredPsuHeaders } from './ebErrors';
import { resolveRedirectUrl } from './ebRedirect';
import { deleteCredentials, loadCredentials, saveCredentials, stripKeyFromConnection } from './ebCredentials';

const ENABLE_BANKING_API = process.env.ENABLE_BANKING_API || 'https://api.enablebanking.com';

/** Maps any thrown error to a client-safe message (never upstream bodies or internal error text). */
const toPublicMessage = (error: any, fallback: string): string => {
  if (error instanceof EnableBankingError) return error.message;
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'Enable Banking did not respond in time. Try again.';
  if (/PEM|private key|asn1|DECODER|secretOrPrivateKey|unsupported/i.test(String(error?.message || ''))) return 'The private key could not be read. Check that it is a PEM private key.';
  return fallback;
};

const JWT_CACHE_LIMIT = 50;
const jwtCache = new Map<string, { token: string; expiresAt: number }>();

class EnableBankingClient {
  constructor(
    private applicationId: string,
    private clientCertificate: string,
    private psuHeaders: Record<string, string> = {},
  ) {}

  private getFormattedKey() {
    let key = this.clientCertificate.trim();
    // Simple heuristic to fix common copy-paste issues where newlines are lost or escaped
    if (!key.includes('\n') && key.includes('BEGIN PRIVATE KEY')) {
       // If it looks like a one-liner but has headers, try to split it
       // This handles the case where \n literals might be present or just spaces
       key = key.replace(/\\n/g, '\n')
                .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
                .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
    }
    return key;
  }

  private generateJwt() {
    const now = Math.floor(Date.now() / 1000);
    const key = this.getFormattedKey();
    const cacheKey = `${this.applicationId}:${crypto.createHash('sha256').update(key).digest('hex')}`;
    const cached = jwtCache.get(cacheKey);
    if (cached && cached.expiresAt > now + 60) {
      return cached.token;
    }

    const token = jwt.sign(
      {
        iss: 'enablebanking.com',
        aud: 'api.enablebanking.com',
        iat: now,
        exp: now + 3600,
      },
      key,
      {
        algorithm: 'RS256',
        keyid: this.applicationId,
      },
    );
    if (jwtCache.size >= JWT_CACHE_LIMIT) {
      for (const [k, v] of jwtCache) if (v.expiresAt <= now) jwtCache.delete(k);
      if (jwtCache.size >= JWT_CACHE_LIMIT) jwtCache.clear();
    }
    jwtCache.set(cacheKey, { token, expiresAt: now + 3600 });
    return token;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = this.generateJwt();
    const url = `${ENABLE_BANKING_API}${path}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...this.psuHeaders,
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Enable Banking request to ${path.split('?')[0]} failed (${response.status}): ${text.slice(0, 500)}`);
      const code = parseErrorCode(text);
      const retryAfterSeconds = response.status === 429 ? (parseRetryAfter(response.headers.get('retry-after')) ?? RATE_LIMIT_RETRY_SECONDS) : undefined;
      throw new EnableBankingError(response.status, publicMessageFor(response.status, code, retryAfterSeconds), code, retryAfterSeconds);
    }

    if (response.status === 204) {
      return {} as T;
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  getAspsps(countryCode?: string) {
    const params = new URLSearchParams();
    if (countryCode && countryCode.toUpperCase() !== 'ALL') {
      params.set('country', countryCode.toUpperCase());
    }
    const query = params.toString();
    return this.request(`/aspsps${query ? `?${query}` : ''}`);
  }

  startAuthorization({
    aspspId,
    aspspName,
    countryCode,
    redirectUrl,
    state,
    psuType,
    maximumConsentValidity,
    language,
    authMethod,
    credentials,
    psuId,
  }: {
    aspspId?: string;
    aspspName?: string;
    countryCode: string;
    redirectUrl: string;
    state?: string;
    psuType?: 'personal' | 'business';
    maximumConsentValidity?: number;
    language?: string;
    authMethod?: string;
    credentials?: Record<string, string>;
    psuId?: string;
  }) {
    const resolvedName = (aspspName || aspspId || '').trim();
    if (!resolvedName) {
      throw new Error('aspspName or aspspId is required');
    }

    // Default to 180 days (PSD2 standard), capped at the bank's `maximum_consent_validity` minus a 60s safety margin.
    const defaultSeconds = 180 * 24 * 60 * 60;
    const maxSeconds = typeof maximumConsentValidity === 'number' && maximumConsentValidity > 120
      ? Math.min(defaultSeconds, maximumConsentValidity - 60)
      : 90 * 24 * 60 * 60;
    const validUntil = new Date(Date.now() + maxSeconds * 1000).toISOString();

    return this.request<{ url: string; authorization_id?: string }>(`/auth`, {
      method: 'POST',
      body: JSON.stringify({
        access: {
          balances: true,
          transactions: true,
          valid_until: validUntil,
        },
        aspsp: {
          name: resolvedName,
          country: countryCode.toUpperCase(),
        },
        psu_type: psuType === 'business' ? 'business' : 'personal',
        redirect_url: redirectUrl,
        state: state || `eb-${Date.now()}`,
        ...(language ? { language: language.slice(0, 2).toLowerCase() } : {}),
        ...(authMethod ? { auth_method: authMethod } : {}),
        ...(authMethod && credentials ? { credentials } : {}),
        ...(psuId ? { psu_id: psuId } : {}),
      }),
    });
  }

  createSession(code: string) {
    return this.request(`/sessions`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  getSession(sessionId: string) {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}`);
  }

  deleteSession(sessionId: string) {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  }

  getAccountBalances(accountId: string) {
    return this.request(`/accounts/${encodeURIComponent(accountId)}/balances`);
  }

  getAccountDetails(accountId: string) {
    return this.request(`/accounts/${encodeURIComponent(accountId)}/details`);
  }

  getAccountTransactions({
    accountId,
    dateFrom,
    dateTo,
    continuationKey,
    strategy,
    transactionStatus,
  }: {
    accountId: string;
    dateFrom?: string;
    dateTo?: string;
    continuationKey?: string;
    strategy?: 'default' | 'longest';
    transactionStatus?: 'BOOK' | 'PDNG';
  }) {
    const params = new URLSearchParams();
    params.set('transaction_status', transactionStatus || 'BOOK');
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (strategy) params.set('strategy', strategy);
    if (continuationKey) params.set('continuation_key', continuationKey);

    return this.request(`/accounts/${encodeURIComponent(accountId)}/transactions?${params.toString()}`);
  }
}

const router = express.Router();

/** PSU context headers for a bank request, shaped by the bank's `required_psu_headers` when the client sends them. */
const psuHeadersFor = (req: express.Request) => buildPsuHeaders(req, sanitizeRequiredPsuHeaders(req.body?.requiredPsuHeaders));

/**
 * Resolves the Enable Banking application id and signing key for a request.
 * A key supplied in the body (first-time entry or replacement) wins and is stored encrypted once the provider
 * accepts it; otherwise the stored key is used, so the key never has to travel from the browser again.
 */
const resolveCredentials = async (req: AuthRequest) => {
  const userId = req.user!.id;
  const body = (req.body || {}) as { applicationId?: string; clientCertificate?: string };
  const suppliedKey = typeof body.clientCertificate === 'string' ? body.clientCertificate.trim() : '';
  const stored = await loadCredentials(userId, body.applicationId);
  if (suppliedKey) {
    const applicationId = (body.applicationId || stored?.applicationId || '').trim();
    return { applicationId, clientCertificate: suppliedKey, isNew: true, userId };
  }
  if (stored) return { ...stored, isNew: false, userId };
  return null;
};

const MISSING_CREDENTIALS = 'Enable Banking credentials are not configured. Enter your application ID and private key first.';

router.get('/credentials', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const stored = await loadCredentials(req.user!.id);
    res.json({ configured: Boolean(stored), applicationId: stored?.applicationId || '' });
  } catch (error) {
    console.error('Failed to read Enable Banking credentials', error);
    res.status(500).json({ message: 'Unable to read credentials' });
  }
});

router.delete('/credentials', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await deleteCredentials(req.user!.id);
    res.json({ message: 'Credentials removed' });
  } catch (error) {
    console.error('Failed to delete Enable Banking credentials', error);
    res.status(500).json({ message: 'Unable to remove credentials' });
  }
});

const sendUpstreamError = (res: express.Response, error: any, fallback: string) => {
  const upstream = error instanceof EnableBankingError ? error : undefined;
  const upstreamStatus = upstream?.status;
  if (upstream?.retryAfterSeconds) res.setHeader('Retry-After', String(upstream.retryAfterSeconds));
  res.status(upstreamStatus === 429 ? 429 : upstreamStatus && upstreamStatus >= 400 && upstreamStatus < 500 ? 502 : 500).json({
    message: toPublicMessage(error, fallback),
    upstreamStatus,
    errorCode: upstream?.code,
    retryAfterSeconds: upstream?.retryAfterSeconds,
    requiresReauth: upstream ? requiresReauthorization(upstream) : false,
  });
};

router.post('/aspsps', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.body;
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !countryCode) {
      return res.status(400).json({ message: creds ? 'applicationId and countryCode are required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate, psuHeadersFor(req));
    const data = await client.getAspsps(countryCode);
    if (creds.isNew) await saveCredentials(creds.userId, creds.applicationId, creds.clientCertificate);
    res.json(data);
  } catch (error: any) {
    console.error('Failed to fetch ASPSPs', error);
    sendUpstreamError(res, error, 'Unable to fetch banks');
  }
});

router.post('/accounts/:accountId/details', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    const { accountId } = req.params as { accountId: string };
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !sessionId) {
      return res.status(400).json({ message: creds ? 'sessionId is required' : MISSING_CREDENTIALS });
    }

    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate, psuHeadersFor(req));
    const details = await client.getAccountDetails(accountId);
    res.json(details);
  } catch (error: any) {
    console.error('Failed to fetch account details', error);
    sendUpstreamError(res, error, 'Unable to fetch account details');
  }
});

router.post('/authorize', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { countryCode, aspspName, aspspId, state, psuType, maximumConsentValidity, language } = req.body;
    const authMethod = sanitizeAuthMethod(req.body.authMethod);
    const credentials = sanitizeCredentials(req.body.credentials, authMethod);
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !countryCode || (!aspspName && !aspspId)) {
      return res.status(400).json({ message: creds ? 'countryCode and aspspId/aspspName are required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate, psuHeadersFor(req));
    const redirectUrl = resolveRedirectUrl({
      configuredUrl: process.env.ENABLE_BANKING_REDIRECT_URL,
      forwardedProto: req.headers['x-forwarded-proto'],
      forwardedHost: req.headers['x-forwarded-host'],
      protocol: req.protocol,
      host: req.get('host'),
    });
    if (!redirectUrl) {
      return res.status(400).json({ message: 'Could not determine a valid callback URL. Set ENABLE_BANKING_REDIRECT_URL on the server.' });
    }
    const data = await client.startAuthorization({
      aspspId,
      aspspName,
      countryCode,
      redirectUrl,
      state,
      psuType,
      maximumConsentValidity: typeof maximumConsentValidity === 'number' ? maximumConsentValidity : undefined,
      language: typeof language === 'string' ? language : undefined,
      authMethod,
      credentials,
      psuId: derivePsuId(creds.userId),
    });
    if (creds.isNew) await saveCredentials(creds.userId, creds.applicationId, creds.clientCertificate);
    res.json({ authorizationUrl: data.url, authorizationId: data.authorization_id, redirectUrl });
  } catch (error: any) {
    console.error('Failed to start authorization', error);
    sendUpstreamError(res, error, 'Unable to start authorization');
  }
});

router.post('/session', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !code) {
      return res.status(400).json({ message: creds ? 'code is required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate, psuHeadersFor(req));
    const session = await client.createSession(code);
    res.json(session);
  } catch (error: any) {
    console.error('Failed to create session', error);
    sendUpstreamError(res, error, 'Unable to create session');
  }
});

router.post('/session/fetch', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !sessionId) {
      return res.status(400).json({ message: creds ? 'sessionId is required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate, psuHeadersFor(req));
    const session = await client.getSession(sessionId);
    res.json(session);
  } catch (error: any) {
    console.error('Failed to fetch session', error);
    sendUpstreamError(res, error, 'Unable to fetch session');
  }
});

router.delete('/session/:sessionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !sessionId) {
      return res.status(400).json({ message: creds ? 'sessionId is required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate, psuHeadersFor(req));
    await client.deleteSession(sessionId);
    res.json({ message: 'Session revoked' });
  } catch (error: any) {
    console.error('Failed to revoke Enable Banking session', error);
    sendUpstreamError(res, error, 'Unable to revoke session');
  }
});

router.post('/accounts/:accountId/balances', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    const { accountId } = req.params as { accountId: string };
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !sessionId) {
      return res.status(400).json({ message: creds ? 'sessionId is required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate, psuHeadersFor(req));
    const balances = await client.getAccountBalances(accountId);
    res.json(balances);
  } catch (error: any) {
    console.error('Failed to fetch balances', error);
    sendUpstreamError(res, error, 'Unable to fetch balances');
  }
});

router.post('/accounts/:accountId/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dateFrom, dateTo, continuationKey, sessionId, strategy, transactionStatus } = req.body as {
      dateFrom?: string;
      dateTo?: string;
      continuationKey?: string;
      sessionId?: string;
      strategy?: 'default' | 'longest';
      transactionStatus?: 'BOOK' | 'PDNG';
    };
    const { accountId } = req.params as { accountId: string };
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !sessionId) {
      return res.status(400).json({ message: creds ? 'sessionId is required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate, psuHeadersFor(req));
    const transactions = await client.getAccountTransactions({
      accountId,
      dateFrom,
      dateTo,
      continuationKey,
      strategy,
      transactionStatus,
    });
    res.json(transactions);
  } catch (error: any) {
    console.error('Failed to fetch transactions', error);
    sendUpstreamError(res, error, 'Unable to fetch transactions');
  }
});

// Pending OAuth connections are kept inside the user's data blob under `enableBankingPendingConnections`.
// Both writers below are single atomic statements that touch only that key (never `lastUpdatedAt` or any
// other slice), so they cannot revert a concurrent POST /api/data (REL-001).
router.post('/pending', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const connection = req.body?.connection;
    if (!userId || !connection?.id || typeof connection.id !== 'string') {
      return res.status(400).json({ message: 'connection with id is required' });
    }

    await db.query(
      `INSERT INTO financial_data (user_id, data)
       VALUES ($1, jsonb_build_object('enableBankingPendingConnections', $2::jsonb))
       ON CONFLICT (user_id)
       DO UPDATE SET data = jsonb_set(
         COALESCE(financial_data.data, '{}'::jsonb),
         '{enableBankingPendingConnections}',
         COALESCE(financial_data.data->'enableBankingPendingConnections', '{}'::jsonb) || $2::jsonb,
         true
       )`,
      [userId, JSON.stringify({ [connection.id]: stripKeyFromConnection(connection) })]
    );

    res.json({ message: 'Pending connection stored' });
  } catch (error: any) {
    console.error('Failed to store pending Enable Banking connection', error);
    res.status(500).json({ message: 'Unable to store pending connection' });
  }
});

router.get('/pending/:connectionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { connectionId } = req.params as { connectionId: string };
    if (!userId || !connectionId) {
      return res.status(400).json({ message: 'connectionId is required' });
    }

    const result = await db.query(
      `SELECT data->'enableBankingPendingConnections'->$2::text AS connection FROM financial_data WHERE user_id = $1`,
      [userId, connectionId]
    );
    const connection = result.rows?.[0]?.connection;
    if (!connection) {
      return res.status(404).json({ message: 'Pending connection not found' });
    }

    res.json({ connection });
  } catch (error: any) {
    console.error('Failed to fetch pending Enable Banking connection', error);
    res.status(500).json({ message: 'Unable to fetch pending connection' });
  }
});

router.delete('/pending/:connectionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { connectionId } = req.params as { connectionId: string };
    if (!userId || !connectionId) {
      return res.status(400).json({ message: 'connectionId is required' });
    }

    await db.query(
      `UPDATE financial_data
       SET data = jsonb_set(data, '{enableBankingPendingConnections}',
                            COALESCE(data->'enableBankingPendingConnections', '{}'::jsonb) - $2::text, true)
       WHERE user_id = $1 AND data ? 'enableBankingPendingConnections'`,
      [userId, connectionId]
    );

    res.json({ message: 'Pending connection removed' });
  } catch (error: any) {
    console.error('Failed to remove pending Enable Banking connection', error);
    res.status(500).json({ message: 'Unable to remove pending connection' });
  }
});

export default router;
