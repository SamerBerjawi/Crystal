
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from './middleware';
import { db } from './database';
import { deleteCredentials, loadCredentials, saveCredentials, stripKeyFromConnection } from './ebCredentials';

const ENABLE_BANKING_API = process.env.ENABLE_BANKING_API || 'https://api.enablebanking.com';
const DEFAULT_REDIRECT = process.env.ENABLE_BANKING_REDIRECT_URL || 'http://localhost:5173/enable-banking/callback';

class EnableBankingClient {
  constructor(private applicationId: string, private clientCertificate: string) {}

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
    
    return jwt.sign(
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
  }

  private async request<T>(
    path: string,
    init: RequestInit & { retryUnauthorized?: boolean; sessionId?: string } = {},
  ): Promise<T> {
    const token = this.generateJwt();
    const url = `${ENABLE_BANKING_API}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.sessionId ? { 'Session-ID': init.sessionId } : {}),
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      // Throw with status code info if possible to help upstream handling
      throw new Error(`Enable Banking request failed (${response.status}): ${text || response.statusText}`);
    }

    return (await response.json()) as T;
  }

  getAspsps(countryCode: string) {
    const params = new URLSearchParams();
    params.set('country', countryCode);
    return this.request(`/aspsps?${params.toString()}`);
  }

  startAuthorization({
    aspspId,
    aspspName,
    countryCode,
    redirectUrl,
    state,
  }: { aspspId?: string; aspspName?: string; countryCode: string; redirectUrl: string; state?: string }) {
    if (!aspspId && !aspspName) {
      throw new Error('aspspId or aspspName is required');
    }
    return this.request<{ url: string; authorization_id: string }>(`/auth`, {
      method: 'POST',
      body: JSON.stringify({
        aspsp: {
          country: countryCode,
          ...(aspspId ? { id: aspspId } : {}),
          ...(aspspName ? { name: aspspName } : {}),
        },
        redirect_url: redirectUrl,
        access: { valid_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString() },
        state,
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

  getAccountBalances(accountId: string, sessionId: string) {
    return this.request(`/accounts/${encodeURIComponent(accountId)}/balances`, { sessionId });
  }

  getAccountDetails(accountId: string, sessionId: string) {
    return this.request(`/accounts/${encodeURIComponent(accountId)}/details`, { sessionId });
  }

  getAccountTransactions({
    accountId,
    dateFrom,
    continuationKey,
    sessionId,
  }: {
    accountId: string;
    dateFrom?: string;
    continuationKey?: string;
    sessionId?: string;
  }) {
    const params = new URLSearchParams();
    params.set('transaction_status', 'BOOK');
    if (dateFrom) params.set('date_from', dateFrom);
    if (continuationKey) params.set('continuation_key', continuationKey);

    return this.request(`/accounts/${encodeURIComponent(accountId)}/transactions?${params.toString()}`, { sessionId });
  }
}

const router = express.Router();

/**
 * Resolves the Enable Banking application id and signing key for a request.
 * A key supplied in the body (first-time entry or replacement) wins and is stored encrypted once the provider
 * accepts it; otherwise the stored key is used, so the key never has to travel from the browser again.
 */
const resolveCredentials = async (req: AuthRequest) => {
  const userId = req.user!.id;
  const body = (req.body || {}) as { applicationId?: string; clientCertificate?: string };
  const suppliedKey = typeof body.clientCertificate === 'string' ? body.clientCertificate.trim() : '';
  const stored = await loadCredentials(userId);
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

router.post('/aspsps', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { countryCode } = req.body;
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !countryCode) {
      return res.status(400).json({ message: creds ? 'applicationId and countryCode are required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate);
    const data = await client.getAspsps(countryCode);
    if (creds.isNew) await saveCredentials(creds.userId, creds.applicationId, creds.clientCertificate);
    res.json(data);
  } catch (error: any) {
    console.error('Failed to fetch ASPSPs', error);
    res.status(500).json({ message: error?.message || 'Unable to fetch banks' });
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

    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate);
    const details = await client.getAccountDetails(accountId, sessionId);
    res.json(details);
  } catch (error: any) {
    console.error('Failed to fetch account details', error);
    res.status(500).json({ message: error?.message || 'Unable to fetch account details' });
  }
});

router.post('/authorize', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { countryCode, aspspName, aspspId, state } = req.body;
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !countryCode || (!aspspName && !aspspId)) {
      return res.status(400).json({ message: creds ? 'countryCode and aspspId/aspspName are required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate);
    const forwardedProto = (Array.isArray(req.headers['x-forwarded-proto']) ? req.headers['x-forwarded-proto'][0] : req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
    const protocol = forwardedProto || req.protocol;
    const forwardedHost = (Array.isArray(req.headers['x-forwarded-host']) ? req.headers['x-forwarded-host'][0] : req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
    const host = forwardedHost || req.get('host');
    const redirectUrl =
      process.env.ENABLE_BANKING_REDIRECT_URL ||
      (host ? `${protocol}://${host.replace(/\s/g, '')}/enable-banking/callback` : DEFAULT_REDIRECT);
    if (!process.env.ENABLE_BANKING_REDIRECT_URL && !host) {
      console.warn('Enable Banking redirect URL falling back to default because host is missing');
    }
    const data = await client.startAuthorization({ aspspId, aspspName, countryCode, redirectUrl, state });
    if (creds.isNew) await saveCredentials(creds.userId, creds.applicationId, creds.clientCertificate);
    res.json({ authorizationUrl: data.url, authorizationId: data.authorization_id, redirectUrl });
  } catch (error: any) {
    console.error('Failed to start authorization', error);
    res.status(500).json({ message: error?.message || 'Unable to start authorization' });
  }
});

router.post('/session', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !code) {
      return res.status(400).json({ message: creds ? 'code is required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate);
    const session = await client.createSession(code);
    res.json(session);
  } catch (error: any) {
    console.error('Failed to create session', error);
    res.status(500).json({ message: error?.message || 'Unable to create session' });
  }
});

router.post('/session/fetch', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !sessionId) {
      return res.status(400).json({ message: creds ? 'sessionId is required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate);
    const session = await client.getSession(sessionId);
    res.json(session);
  } catch (error: any) {
    console.error('Failed to fetch session', error);
    res.status(500).json({ message: error?.message || 'Unable to fetch session' });
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
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate);
    const balances = await client.getAccountBalances(accountId, sessionId);
    res.json(balances);
  } catch (error: any) {
    console.error('Failed to fetch balances', error);
    res.status(500).json({ message: error?.message || 'Unable to fetch balances' });
  }
});

router.post('/accounts/:accountId/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dateFrom, continuationKey, sessionId } = req.body as {
      dateFrom?: string;
      continuationKey?: string;
      sessionId?: string;
    };
    const { accountId } = req.params as { accountId: string };
    const creds = await resolveCredentials(req);
    if (!creds || !creds.applicationId || !sessionId) {
      return res.status(400).json({ message: creds ? 'sessionId is required' : MISSING_CREDENTIALS });
    }
    const client = new EnableBankingClient(creds.applicationId, creds.clientCertificate);
    const transactions = await client.getAccountTransactions({ accountId, dateFrom, continuationKey, sessionId });
    res.json(transactions);
  } catch (error: any) {
    console.error('Failed to fetch transactions', error);
    res.status(500).json({ message: error?.message || 'Unable to fetch transactions' });
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
