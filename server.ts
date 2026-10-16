import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import * as urlGuardNs from './server/src/urlGuard';

// server/ is a CommonJS package; under tsx its exports arrive on `default`.
const urlGuard: typeof urlGuardNs = (urlGuardNs as any).default ?? urlGuardNs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  // Local development only: listen on loopback unless the operator opts in to something else.
  const HOST = process.env.HOST || '127.0.0.1';
  // The in-memory mock API is for UI work without a backend. It must be asked for explicitly.
  const MOCK_API_ENABLED = process.env.CRYSTAL_MOCK_API === '1';

  // The page and the API are served from the same origin, so no CORS headers are needed.
  app.use(express.json({ limit: '50mb' }));

  // Deactivate and self-unregister any stale service worker lingering in browser
  app.get(['/sw.js', '/registerSW.js'], (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(`
      self.addEventListener('install', () => self.skipWaiting());
      self.addEventListener('activate', (event) => {
        event.waitUntil(
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.registration.unregister())
        );
      });
    `);
  });

  const BACKEND_TARGET = process.env.VITE_BACKEND_URL;

  // In-memory mock storage for AI Studio self-contained runtime
  interface MockUser {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    profilePictureUrl?: string;
    phone?: string;
    address?: string;
    defaultCity?: string;
    role: string;
    is2FAEnabled: boolean;
    status: string;
    lastLogin: string;
  }

  const mockUsers = new Map<string, { user: MockUser; password: string }>();
  const mockFinancialData = new Map<number, any>();
  const activeSessions = new Map<string, number>();

  const defaultUser: MockUser = {
    id: 1,
    firstName: 'Demo',
    lastName: 'User',
    email: 'demo@crystal.app',
    profilePictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    phone: '+1 (555) 019-2834',
    address: '100 Financial Way, Suite 400',
    defaultCity: 'San Francisco, CA',
    role: 'Member',
    is2FAEnabled: false,
    status: 'Active',
    lastLogin: new Date().toISOString(),
  };
  mockUsers.set('demo@crystal.app', { user: defaultUser, password: 'password' });

  function getSessionUser(req: express.Request): MockUser | null {
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/crystal_session=([^;]+)/);
    const sessionId = match ? match[1] : null;
    if (sessionId && activeSessions.has(sessionId)) {
      const uid = activeSessions.get(sessionId)!;
      for (const entry of mockUsers.values()) {
        if (entry.user.id === uid) return entry.user;
      }
    }
    return null;
  }

  async function handleMockApi(req: express.Request, res: express.Response) {
    const subpath = req.path;

    if (subpath === '/health' || subpath === '') {
      return res.json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
    }

    if (subpath === '/auth/me') {
      const user = getSessionUser(req);
      if (user) {
        return res.json(user);
      }
      return res.status(401).json({ status: 'unauthenticated' });
    }

    if (subpath === '/auth/login' && req.method === 'POST') {
      const { email, password } = req.body || {};
      const normalizedEmail = String(email || '').toLowerCase().trim();
      const record = mockUsers.get(normalizedEmail);
      if (!record || typeof password !== 'string' || record.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      record.user.lastLogin = new Date().toISOString();
      const sessionId = 'sess_' + randomBytes(24).toString('hex');
      activeSessions.set(sessionId, record.user.id);
      res.setHeader('Set-Cookie', `crystal_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
      const financialData = mockFinancialData.get(record.user.id) || {};
      return res.json({ user: record.user, financialData });
    }

    if (subpath === '/auth/register' && req.method === 'POST') {
      const { firstName, lastName, email, password } = req.body || {};
      const normalizedEmail = String(email || '').toLowerCase().trim();
      if (!normalizedEmail || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: 'A valid email and a password of at least 8 characters are required.' });
      }
      if (mockUsers.has(normalizedEmail)) return res.status(409).json({ message: 'Email already in use.' });
      const newUser: MockUser = {
        id: Math.max(0, ...Array.from(mockUsers.values()).map(r => r.user.id)) + 1,
        firstName: firstName || 'New',
        lastName: lastName || 'User',
        email: normalizedEmail,
        profilePictureUrl: '',
        role: 'Member',
        is2FAEnabled: false,
        status: 'Active',
        lastLogin: new Date().toISOString(),
      };
      mockUsers.set(normalizedEmail, { user: newUser, password });
      const sessionId = 'sess_' + randomBytes(24).toString('hex');
      activeSessions.set(sessionId, newUser.id);
      res.setHeader('Set-Cookie', `crystal_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
      return res.status(201).json({ user: newUser, financialData: {} });
    }

    if (subpath === '/auth/logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', 'crystal_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
      return res.json({ status: 'ok', message: 'Logged out successfully' });
    }

    if (subpath === '/data') {
      const user = getSessionUser(req);
      if (!user) return res.status(401).json({ message: 'Authentication required.' });
      const uid = user.id;
      if (req.method === 'GET') {
        const data = mockFinancialData.get(uid) || {};
        return res.json(data);
      }
      if (req.method === 'POST') {
        if (req.body?.partial && req.body?.data) {
          const prev = mockFinancialData.get(uid) || {};
          mockFinancialData.set(uid, { ...prev, ...req.body.data });
        } else {
          mockFinancialData.set(uid, req.body);
        }
        return res.json({ status: 'ok', message: 'Data saved successfully' });
      }
    }

    if (subpath === '/users/me') {
      const user = getSessionUser(req);
      if (!user) return res.status(401).json({ status: 'unauthenticated' });
      if (req.method === 'PUT') {
        Object.assign(user, req.body);
        return res.json(user);
      }
      return res.json(user);
    }

    if (subpath === '/users/me/change-password' && req.method === 'POST') {
      const user = getSessionUser(req);
      if (!user) return res.status(401).json({ message: 'Authentication required.' });
      const { currentPassword, newPassword } = req.body || {};
      const record = mockUsers.get(user.email);
      if (!record || record.password !== currentPassword) return res.status(401).json({ message: 'Incorrect current password' });
      if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
      record.password = newPassword;
      return res.json({ message: 'Password updated successfully. Please sign in again.' });
    }

    if (subpath === '/smart-fetch') {
      if (!getSessionUser(req)) return res.status(401).json({ message: 'Authentication required.' });
      const targetUrl = req.query.url;
      if (typeof targetUrl !== 'string' || !targetUrl) return res.status(400).json({ error: 'URL query param required' });
      try {
        const result = await urlGuard.safeFetchText(targetUrl);
        return res.type('text/html').send(result.body);
      } catch (err: any) {
        if (err instanceof urlGuard.UrlBlockedError) return res.status(400).json({ error: err.message });
        return res.status(502).json({ error: 'Failed to fetch page' });
      }
    }

    if (subpath.startsWith('/enable-banking')) {
      if (!getSessionUser(req)) return res.status(401).json({ message: 'Authentication required.' });
      return res.json({ status: 'ok', aspsps: [], sessions: [] });
    }

    return res.status(404).json({ error: `Not found: ${subpath}` });
  }

  // Handle /api requests (proxy if configured, fallback to in-memory mock)
  app.use('/api', async (req, res, next) => {
    if (!BACKEND_TARGET) {
      if (MOCK_API_ENABLED) return handleMockApi(req, res);
      return res.status(503).json({
        message: 'No API backend is configured. Set VITE_BACKEND_URL to a running Crystal backend, or CRYSTAL_MOCK_API=1 for the in-memory mock.',
      });
    }

    const targetUrl = `${BACKEND_TARGET}${req.originalUrl}`;
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value && key !== 'host' && key !== 'content-length') {
          if (Array.isArray(value)) {
            value.forEach(v => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body) {
        fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
      }

      const backendRes = await fetch(targetUrl, fetchOptions);

      backendRes.headers.forEach((val, key) => {
        if (key.toLowerCase() !== 'transfer-encoding') {
          res.setHeader(key, val);
        }
      });

      res.status(backendRes.status);
      const arrayBuffer = await backendRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.warn(`[Proxy] Backend unreachable at ${targetUrl}`);
      if (MOCK_API_ENABLED) return handleMockApi(req, res);
      return res.status(502).json({ message: 'The API backend is unreachable.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}${MOCK_API_ENABLED && !BACKEND_TARGET ? ' (in-memory mock API)' : ''}`);
  });
}

startServer();
