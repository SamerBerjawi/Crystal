import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: true,
    credentials: true,
  }));
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

  // AI Proxy Endpoint
  app.post('/api/ai/proxy', async (req, res) => {
    const { endpoint, method, headers, body } = req.body;

    try {
      console.log(`Proxying ${method} request to ${endpoint}`);
      const response = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('AI Provider Error:', data);
        return res.status(response.status).json(data);
      }
      res.json(data);
    } catch (error: any) {
      console.error('Proxy Error:', error.message);
      res.status(500).json({ error: { message: error.message } });
    }
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
    // If only 1 user exists or in dev fallback, return that user
    if (mockUsers.size === 1) {
      return Array.from(mockUsers.values())[0].user;
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
      const normalizedEmail = (email || 'demo@crystal.app').toLowerCase().trim();
      let record = mockUsers.get(normalizedEmail);
      if (!record) {
        const newUser: MockUser = {
          id: mockUsers.size + 1,
          firstName: normalizedEmail.split('@')[0] || 'User',
          lastName: '',
          email: normalizedEmail,
          profilePictureUrl: `https://i.pravatar.cc/150?u=${normalizedEmail}`,
          role: 'Member',
          is2FAEnabled: false,
          status: 'Active',
          lastLogin: new Date().toISOString(),
        };
        record = { user: newUser, password: password || 'password' };
        mockUsers.set(normalizedEmail, record);
      }
      record.user.lastLogin = new Date().toISOString();
      const sessionId = 'sess_' + Math.random().toString(36).substring(2);
      activeSessions.set(sessionId, record.user.id);
      res.setHeader('Set-Cookie', `crystal_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
      const financialData = mockFinancialData.get(record.user.id) || {};
      return res.json({ user: record.user, financialData });
    }

    if (subpath === '/auth/register' && req.method === 'POST') {
      const { firstName, lastName, email, password } = req.body || {};
      const normalizedEmail = (email || `user_${Date.now()}@crystal.app`).toLowerCase().trim();
      const newUser: MockUser = {
        id: mockUsers.size + 1,
        firstName: firstName || 'New',
        lastName: lastName || 'User',
        email: normalizedEmail,
        profilePictureUrl: `https://i.pravatar.cc/150?u=${normalizedEmail}`,
        role: 'Member',
        is2FAEnabled: false,
        status: 'Active',
        lastLogin: new Date().toISOString(),
      };
      mockUsers.set(normalizedEmail, { user: newUser, password: password || 'password' });
      const sessionId = 'sess_' + Math.random().toString(36).substring(2);
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
      const uid = user ? user.id : 1;
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

    if (subpath === '/users/me/change-password') {
      return res.json({ status: 'ok', message: 'Password updated successfully' });
    }

    if (subpath === '/smart-fetch') {
      const targetUrl = req.query.url as string;
      if (!targetUrl) return res.status(400).json({ error: 'URL query param required' });
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
          },
        });
        const html = await response.text();
        return res.type('text/html').send(html);
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to fetch page', message: err.message });
      }
    }

    if (subpath.startsWith('/enable-banking')) {
      return res.json({ status: 'ok', aspsps: [], sessions: [] });
    }

    return res.status(404).json({ error: `Not found: ${subpath}` });
  }

  // Handle /api requests (proxy if configured, fallback to in-memory mock)
  app.use('/api', async (req, res, next) => {
    if (!BACKEND_TARGET) {
      return handleMockApi(req, res);
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
      console.warn(`[Proxy] Backend unreachable at ${targetUrl}, using in-memory mock handler`);
      return handleMockApi(req, res);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
