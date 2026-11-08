import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import * as urlGuardNs from './server/src/urlGuard';
import { fakeCompletion, fakeReply, fakeStreamLines } from './dev/fakeLlm';

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

  function handleMockLock(req: express.Request, res: express.Response, subpath: string, session: string) {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ message: 'Authentication required.' });
    const record = mockUsers.get(user.email);
    const { password, pin } = req.body || {};
    if (subpath === '/lock/status') return res.json({ hasPin: mockPins.has(user.id), isLocked: mockLockedSessions.has(session) });
    if (subpath === '/lock/pin') {
      if (record?.password !== password) return res.status(401).json({ message: 'Your password is wrong.' });
      if (req.method === 'DELETE') {
        mockPins.delete(user.id);
        mockLockedSessions.clear();
        return res.json({ hasPin: false });
      }
      if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return res.status(400).json({ message: 'A PIN is four digits.' });
      mockPins.set(user.id, pin);
      return res.json({ hasPin: true });
    }
    if (subpath === '/lock/lock') {
      if (!mockPins.has(user.id)) return res.status(409).json({ message: 'Set a PIN first.' });
      mockLockedSessions.add(session);
      mockPinFailures.set(session, 0);
      return res.json({ isLocked: true });
    }
    if (subpath === '/lock/unlock') {
      if (pin === mockPins.get(user.id)) {
        mockLockedSessions.delete(session);
        return res.json({ isLocked: false });
      }
      const failures = (mockPinFailures.get(session) ?? 0) + 1;
      mockPinFailures.set(session, failures);
      if (failures >= 5) {
        mockLockedSessions.delete(session);
        activeSessions.delete(session);
        res.setHeader('Set-Cookie', 'crystal_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
        return res.status(401).json({ message: 'Too many wrong PINs.', triesLeft: 0, isSignedOut: true });
      }
      return res.status(401).json({ message: 'Wrong PIN.', triesLeft: 5 - failures, isSignedOut: false });
    }
    return res.status(404).json({ error: `Not found: ${subpath}` });
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

  let mockAlerts: { enabled: boolean; channel: { kind: string; url: string; topic?: string; token?: string } | null; rules: Record<string, number | boolean> } = {
    enabled: false,
    channel: null,
    rules: { consent: true, budget: true, budgetThreshold: 0.8, duplicate: true, lowBalance: true, lowBalanceFloor: 0, lowBalanceDays: 7, priceHike: true },
  };
  // Ask Crystal in the mock: a scripted model (dev/fakeLlm.ts) behind the same routes the real server has.
  const mockCatalog = [
    { name: 'qwen3:4b', label: 'Qwen3 4B', approxGb: 2.5, note: 'A good balance for a NAS CPU. Start here.' },
    { name: 'qwen3:8b', label: 'Qwen3 8B', approxGb: 5.2, note: 'More accurate. Wants about 8 GB of free memory, or a GPU.' },
    { name: 'llama3.2:3b', label: 'Llama 3.2 3B', approxGb: 2.0, note: 'Smallest and fastest, but weaker on multi-step questions.' },
  ];
  const mockAssistant = { provider: 'builtin' as 'builtin' | 'custom', baseUrl: '', model: 'qwen3:4b', apiKey: '' };
  let mockModels: { name: string; sizeBytes: number; parameterSize: string; quantization: string }[] = [{ name: 'qwen3:4b', sizeBytes: 2.5e9, parameterSize: '4B', quantization: 'Q4_K_M' }];
  const mockLockedSessions = new Set<string>();
  const mockPins = new Map<number, string>();
  const mockPinFailures = new Map<string, number>();
  const mockSessionId = (req: express.Request) => (req.headers.cookie || '').match(/crystal_session=([^;]+)/)?.[1] ?? '';

  async function handleMockApi(req: express.Request, res: express.Response) {
    const subpath = req.path;
    const lockSession = mockSessionId(req);

    if (subpath.startsWith('/lock')) return handleMockLock(req, res, subpath, lockSession);

    // Same rule as server/src/lockRules.ts.
    if (mockLockedSessions.has(lockSession) && subpath !== '/auth/me' && subpath !== '/auth/logout') {
      return res.status(423).json({ message: 'Crystal is locked.', isLocked: true });
    }

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

    if (subpath.startsWith('/alerts')) {
      if (!getSessionUser(req)) return res.status(401).json({ message: 'Authentication required.' });
      const view = () => ({
        enabled: mockAlerts.enabled,
        channel: mockAlerts.channel ? { kind: mockAlerts.channel.kind, url: mockAlerts.channel.url, topic: mockAlerts.channel.topic ?? '', hasToken: Boolean(mockAlerts.channel.token) } : null,
        rules: mockAlerts.rules,
        privateUrlsAllowed: false,
      });
      if (subpath === '/alerts' && req.method === 'GET') return res.json(view());
      if (subpath === '/alerts' && req.method === 'PUT') {
        const { enabled, channel, rules } = req.body ?? {};
        mockAlerts = {
          enabled: Boolean(enabled),
          channel: channel ? { ...channel, token: channel.token === undefined ? mockAlerts.channel?.token : channel.token } : null,
          rules: { ...mockAlerts.rules, ...(rules ?? {}) },
        };
        return res.json(view());
      }
      if (subpath === '/alerts/test' && req.method === 'POST') {
        return mockAlerts.channel ? res.json({ message: 'Test sent' }) : res.status(400).json({ message: 'Save a way to send alerts first.' });
      }
    }

    if (subpath.startsWith('/assistant')) {
      if (!getSessionUser(req)) return res.status(401).json({ message: 'Authentication required.' });
      const view = () => ({
        provider: mockAssistant.provider, baseUrl: mockAssistant.baseUrl, model: mockAssistant.model, hasKey: Boolean(mockAssistant.apiKey),
        builtin: { reachable: true, version: 'mock' }, catalog: mockCatalog, privateUrlsAllowed: true,
      });
      if (subpath === '/assistant' && req.method === 'GET') return res.json(view());
      if (subpath === '/assistant' && req.method === 'PUT') {
        const { provider, baseUrl, model, apiKey } = req.body ?? {};
        mockAssistant.provider = provider === 'custom' ? 'custom' : 'builtin';
        mockAssistant.baseUrl = provider === 'custom' ? String(baseUrl ?? '') : '';
        mockAssistant.model = model ? String(model) : '';
        if (apiKey !== undefined) mockAssistant.apiKey = String(apiKey);
        return res.json(view());
      }
      if (subpath === '/assistant/models' && req.method === 'GET') {
        return res.json({ models: mockAssistant.provider === 'builtin' ? mockModels : [{ name: 'qwen3:4b' }, { name: 'llama3.1:8b' }] });
      }
      if (subpath === '/assistant/models' && req.method === 'DELETE') {
        mockModels = mockModels.filter(m => m.name !== req.body?.model);
        if (mockAssistant.model === req.body?.model) mockAssistant.model = '';
        return res.json({ message: 'Removed' });
      }
      if (subpath === '/assistant/models/info') return res.json({ supportsTools: true });
      if (subpath === '/assistant/models/pull' && req.method === 'POST') {
        const name = String(req.body?.model ?? '');
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });
        const total = 2.5e9;
        let step = 0;
        res.write(`${JSON.stringify({ status: 'pulling manifest' })}\n`);
        const timer = setInterval(() => {
          step += 1;
          if (step <= 10) res.write(`${JSON.stringify({ status: 'pulling aaa', digest: 'aaa', total, completed: (total * step) / 10 })}\n`);
          else {
            clearInterval(timer);
            if (!mockModels.some(m => m.name === name)) mockModels.push({ name, sizeBytes: total, parameterSize: '4B', quantization: 'Q4_K_M' });
            res.write(`${JSON.stringify({ status: 'success' })}\n`);
            res.end();
          }
        }, 300);
        res.on('close', () => clearInterval(timer));
        return;
      }
      if (subpath === '/assistant/test' && req.method === 'POST') return res.json({ ok: true, reply: 'ok', supportsTools: true });
      if (subpath === '/assistant/chat' && req.method === 'POST') {
        const reply = fakeReply(Array.isArray(req.body?.messages) ? req.body.messages : []);
        if (!req.body?.stream) return res.json(fakeCompletion(reply));
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
        const lines = fakeStreamLines(reply);
        let i = 0;
        const timer = setInterval(() => {
          if (i < lines.length) res.write(lines[i++]);
          else { clearInterval(timer); res.end(); }
        }, 25);
        res.on('close', () => clearInterval(timer));
        return;
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
      const contentType = backendRes.headers.get('content-type') ?? '';
      if (backendRes.body && (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson'))) {
        // Answers that arrive over time (a model's words, a download's progress) must not wait to be buffered whole.
        res.flushHeaders();
        const upstream = Readable.fromWeb(backendRes.body as any);
        res.on('close', () => upstream.destroy());
        upstream.pipe(res);
        return;
      }
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
