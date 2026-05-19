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
