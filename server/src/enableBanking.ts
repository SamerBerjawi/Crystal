
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from './middleware';
import { db } from './database';

const ENABLE_BANKING_API = process.env.ENABLE_BANKING_API || 'https://api.enablebanking.com';
const DEFAULT_REDIRECT = process.env.ENABLE_BANKING_REDIRECT_URL || 'http://localhost:5173/enable-banking/callback';

class EnableBankingClient {
  constructor(private applicationId: string, private clientCertificate: string) {}

  private generateJwt() {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      {
        iss: 'enablebanking.com',
        aud: 'api.enablebanking.com',
        iat: now,
        exp: now + 3600,
      },
      this.clientCertificate,
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
    aspspName,
    countryCode,
    redirectUrl,
    state,
  }: { aspspName: string; countryCode: string; redirectUrl: string; state?: string }) {
    return this.request<{ url: string; authorization_id: string }>(`/auth`, {
      method: 'POST',
      body: JSON.stringify({
        aspsp: { name: aspspName, country: countryCode },
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

router.post('/aspsps', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { applicationId, clientCertificate, countryCode } = req.body;
    if (!applicationId || !clientCertificate || !countryCode) {
      return res.status(400).json({ message: 'applicationId, clientCertificate and countryCode are required' });
    }
    const client = new EnableBankingClient(applicationId, clientCertificate);
    const data = await client.getAspsps(countryCode);
    res.json(data);
  } catch (error: any) {
    console.error('Failed to fetch ASPSPs', error);
    res.status(502).json({ message: error?.message || 'Unable to fetch banks' });
  }
});

router.post('/accounts/:accountId/details', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { applicationId, clientCertificate, sessionId } = req.body as {
      applicationId?: string;
      clientCertificate?: string;
      sessionId?: string;
    };
    const { accountId } = (req as express.Request).params;

    if (!applicationId || !clientCertificate || !sessionId) {
      return res.status(400).json({ message: 'applicationId, clientCertificate and sessionId are required' });
    }

    const client = new EnableBankingClient(applicationId, clientCertificate);
    const details = await client.getAccountDetails(accountId, sessionId);
    res.json(details);
  } catch (error: any) {
    console.error('Failed to fetch account details', error);
    res.status(502).json({ message: error?.message || 'Unable to fetch account details' });
  }
});

router.post('/authorize', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { applicationId, clientCertificate, countryCode, aspspName, state } = req.body;
    if (!applicationId || !clientCertificate || !countryCode || !aspspName) {
      return res.status(400).json({ message: 'applicationId, clientCertificate, countryCode and aspspName are required' });
    }
    const client = new EnableBankingClient(applicationId, clientCertificate);
    const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
    const protocol = forwardedProto || (req as express.Request).protocol;
    const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
    const host = forwardedHost || (req as express.Request).get('host');
    const redirectUrl =
      process.env.ENABLE_BANKING_REDIRECT_URL ||
      (host ? `${protocol}://${host.replace(/\s/g, '')}/enable-banking/callback` : DEFAULT_REDIRECT);
    if (!process.env.ENABLE_BANKING_REDIRECT_URL && !host) {
      console.warn('Enable Banking redirect URL falling back to default because host is missing');
    }
    const data = await client.startAuthorization({ aspspName, countryCode, redirectUrl, state });
    res.json({ authorizationUrl: data.url, authorizationId: data.authorization_id, redirectUrl });
  } catch (error: any) {
    console.error('Failed to start authorization', error);
    res.status(502).json({ message: error?.message || 'Unable to start authorization' });
  }
});

router.post('/session', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { applicationId, clientCertificate, code } = req.body;
    if (!applicationId || !clientCertificate || !code) {
      return res.status(400).json({ message: 'applicationId, clientCertificate and code are required' });
    }
    const client = new EnableBankingClient(applicationId, clientCertificate);
    const session = await client.createSession(code);
    res.json(session);
  } catch (error: any) {
    console.error('Failed to create session', error);
    res.status(502).json({ message: error?.message || 'Unable to create session' });
  }
});

router.post('/session/fetch', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { applicationId, clientCertificate, sessionId } = req.body as { applicationId?: string; clientCertificate?: string; sessionId?: string };
    if (!applicationId || !clientCertificate || !sessionId) {
      return res.status(400).json({ message: 'applicationId, clientCertificate and sessionId are required' });
    }
    const client = new EnableBankingClient(applicationId, clientCertificate);
    const session = await client.getSession(sessionId);
    res.json(session);
  } catch (error: any) {
    console.error('Failed to fetch session', error);
    res.status(502).json({ message: error?.message || 'Unable to fetch session' });
  }
});

router.post('/accounts/:accountId/balances', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { applicationId, clientCertificate, sessionId } = req.body as {
      applicationId?: string;
      clientCertificate?: string;
      sessionId?: string;
    };
    const { accountId } = (req as express.Request).params;
    if (!applicationId || !clientCertificate || !sessionId) {
      return res.status(400).json({ message: 'applicationId, clientCertificate and sessionId are required' });
    }
    const client = new EnableBankingClient(applicationId, clientCertificate);
    const balances = await client.getAccountBalances(accountId, sessionId);
    res.json(balances);
  } catch (error: any) {
    console.error('Failed to fetch balances', error);
    res.status(502).json({ message: error?.message || 'Unable to fetch balances' });
  }
});

router.post('/accounts/:accountId/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { applicationId, clientCertificate, dateFrom, continuationKey, sessionId } = req.body as {
      applicationId?: string;
      clientCertificate?: string;
      dateFrom?: string;
      continuationKey?: string;
      sessionId?: string;
    };
    const { accountId } = (req as express.Request).params;
    if (!applicationId || !clientCertificate || !sessionId) {
      return res.status(400).json({ message: 'applicationId, clientCertificate and sessionId are required' });
    }
    const client = new EnableBankingClient(applicationId, clientCertificate);
    const transactions = await client.getAccountTransactions({ accountId, dateFrom, continuationKey, sessionId });
    res.json(transactions);
  } catch (error: any) {
    console.error('Failed to fetch transactions', error);
    res.status(502).json({ message: error?.message || 'Unable to fetch transactions' });
  }
});

router.post('/pending', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const connection = req.body?.connection;
    if (!userId || !connection?.id) {
      return res.status(400).json({ message: 'connection with id is required' });
    }

    const selectSql = `SELECT data FROM financial_data WHERE user_id = $1`;
    const upsertSql = `
        INSERT INTO financial_data (user_id, data)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET data = EXCLUDED.data;
    `;
    const existing = await db.query(selectSql, [userId]);
    const currentData = existing.rows?.[0]?.data || {};
    const pendingConnections = {
      ...(currentData.enableBankingPendingConnections || {}),
      [connection.id]: connection,
    };
    const mergedData = { ...currentData, enableBankingPendingConnections: pendingConnections };
    await db.query(upsertSql, [userId, mergedData]);

    res.json({ message: 'Pending connection stored' });
  } catch (error: any) {
    console.error('Failed to store pending Enable Banking connection', error);
    res.status(500).json({ message: error?.message || 'Unable to store pending connection' });
  }
});

router.get('/pending/:connectionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { connectionId } = (req as express.Request).params;
    if (!userId || !connectionId) {
      return res.status(400).json({ message: 'connectionId is required' });
    }

    const selectSql = `SELECT data FROM financial_data WHERE user_id = $1`;
    const existing = await db.query(selectSql, [userId]);
    const currentData = existing.rows?.[0]?.data || {};
    const pendingConnections = currentData.enableBankingPendingConnections || {};
    const connection = pendingConnections[connectionId];

    if (!connection) {
      return res.status(404).json({ message: 'Pending connection not found' });
    }

    res.json({ connection });
  } catch (error: any) {
    console.error('Failed to fetch pending Enable Banking connection', error);
    res.status(500).json({ message: error?.message || 'Unable to fetch pending connection' });
  }
});

router.delete('/pending/:connectionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { connectionId } = (req as express.Request).params;
    if (!userId || !connectionId) {
      return res.status(400).json({ message: 'connectionId is required' });
    }

    const selectSql = `SELECT data FROM financial_data WHERE user_id = $1`;
    const upsertSql = `
        INSERT INTO financial_data (user_id, data)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET data = EXCLUDED.data;
    `;
    const existing = await db.query(selectSql, [userId]);
    const currentData = existing.rows?.[0]?.data || {};
    const pendingConnections = { ...(currentData.enableBankingPendingConnections || {}) };
    if (pendingConnections[connectionId]) {
      delete pendingConnections[connectionId];
      const mergedData = { ...currentData, enableBankingPendingConnections: pendingConnections };
      await db.query(upsertSql, [userId, mergedData]);
    }

    res.json({ message: 'Pending connection removed' });
  } catch (error: any) {
    console.error('Failed to remove pending Enable Banking connection', error);
    res.status(500).json({ message: error?.message || 'Unable to remove pending connection' });
  }
});

export default router;
