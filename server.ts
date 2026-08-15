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

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

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

  const BACKEND_TARGET = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

  // Proxy /api requests to the backend server (preserving auth, cookies, data payload)
  app.use('/api', async (req, res, next) => {
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
      if (req.path === '/data') {
        if (req.method === 'GET') {
          return res.json({});
        }
        return res.json({ status: 'ok', message: 'Backend unreachable, saved locally' });
      }
      if (req.path === '/auth/status' || req.path === '/auth/me') {
        return res.status(401).json({ status: 'unauthenticated' });
      }
      console.warn(`[Proxy] Backend unreachable at ${targetUrl}:`, err.message);
      res.status(502).json({ error: 'Backend unreachable', message: err.message });
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
