import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Import backend logic from server directory
import authRouter from './server/src/auth.ts';
import dataRouter from './server/src/data.ts';
import usersRouter from './server/src/users.ts';
import enableBankingRouter from './server/src/enableBanking.ts';
import smartFetcherRouter from './server/src/smartFetcher.ts';
import { initializeDatabase } from './server/src/database.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize database
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization failed:', err);
    // Continue starting the server even if DB fails, so we don't block the preview
  }

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

  // Mount backend routers
  app.use('/api/auth', authRouter);
  app.use('/api/data', dataRouter);
  app.use('/api/enable-banking', enableBankingRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/smart-fetch', smartFetcherRouter);

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
