import * as path from 'path';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'process';

const createBundleAnalyzerPlugin = (): PluginOption => ({
  name: 'bundle-size-analyzer',
  generateBundle(_, bundle) {
    const textEncoder = new TextEncoder();
    const summary = Object.entries(bundle)
      .map(([fileName, output]) => {
        const size = textEncoder.encode('code' in output ? output.code : String(output.source)).length;
        return {
          fileName,
          type: output.type,
          size,
          modules: output.type === 'chunk' ? Object.keys(output.modules) : undefined,
        };
      })
      .sort((a, b) => b.size - a.size);

    const report = JSON.stringify(summary, null, 2);
    this.emitFile({ type: 'asset', fileName: 'stats/bundle-report.json', source: report });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const backendTarget = env.VITE_BACKEND_URL || 'http://localhost:3001';
  const shouldAnalyze = env.ANALYZE === 'true' || process.env.ANALYZE === 'true';

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
    plugins: [
      react(),
      shouldAnalyze && createBundleAnalyzerPlugin(),
    ].filter(Boolean) as PluginOption[],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        treeshake: true,
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            leaflet: ['leaflet', 'react-leaflet'],
            recharts: ['recharts'],
            reactQuery: ['@tanstack/react-query'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
  };
});
