import * as path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// FIX: Import the `process` object to resolve TypeScript type errors with `process.cwd()`.
import process from 'process';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const backendTarget = env.VITE_BACKEND_URL || 'http://localhost:3001';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: backendTarget,
            changeOrigin: true,
            secure: false,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // FIX: Replaced `__dirname` with `process.cwd()` to resolve the "Cannot find name '__dirname'" error in an ES module context.
          '@': path.resolve(process.cwd(), '.'),
        }
      }
    };
});