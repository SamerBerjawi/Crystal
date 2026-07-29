import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { isAllowedTargetUrl } from './server/src/urlValidator';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // AI Proxy Endpoint
  app.post('/api/ai/proxy', async (req, res) => {
    const authHeader = req.headers.authorization;
    const cookieHeader = req.headers.cookie || '';
    const hasSessionCookie = cookieHeader.includes('crystal_session=');
    const hasBearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');

    if (!hasSessionCookie && !hasBearerToken) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { endpoint, method, headers, body } = req.body;

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'Endpoint URL is required.' });
    }

    const validation = isAllowedTargetUrl(endpoint);
    if (!validation.allowed) {
      return res.status(403).json({ error: validation.reason || 'Forbidden target domain.' });
    }

    try {
      console.log(`Proxying ${method || 'POST'} request to ${endpoint}`);
      const response = await fetch(endpoint, {
        method: method || 'POST',
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

  // Mock data endpoint to prevent errors in App.tsx
  app.post('/api/data', (req, res) => {
    res.json({ status: 'ok', message: 'Data saved (mock)' });
  });

  app.get('/api/data', (req, res) => {
    res.json({});
  });

  // Authentication mocks if needed
  app.post('/api/auth/status', (req, res) => {
    res.json({ status: 'unauthenticated' });
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
