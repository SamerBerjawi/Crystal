import * as fs from 'fs';
import * as path from 'path';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'process';
import tailwindcss from "@tailwindcss/vite";

/**
 * MapLibre starts its worker from a file next to its own chunk (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`).
 * Rollup does not see that reference, so the production build left the file out and every map stayed blank
 * (dev worked, because Vite serves it from node_modules). Emit it, and its shared sibling, into `assets/` beside the chunk.
 */
const emitMaplibreWorker = (): PluginOption => ({
  name: 'emit-maplibre-worker',
  apply: 'build',
  generateBundle() {
    const dist = path.resolve(process.cwd(), 'node_modules/maplibre-gl/dist');
    for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
      const source = path.join(dist, file);
      if (fs.existsSync(source)) this.emitFile({ type: 'asset', fileName: `assets/${file}`, source: fs.readFileSync(source) });
    }
  },
});

const createBundleAnalyzerPlugin = (): PluginOption => ({
  name: 'bundle-size-analyzer',
  generateBundle(_, bundle: any) {
    const textEncoder = new TextEncoder();
    const summary = Object.entries(bundle)
      .map(([fileName, output]: [string, any]) => {
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
      allowedHosts: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 4173,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [
      tailwindcss(),
      react(),
      emitMaplibreWorker(),
      shouldAnalyze && createBundleAnalyzerPlugin(),
    ].filter(Boolean) as PluginOption[],
    // MapLibre locates its worker file relative to its own module, which pre-bundling would break.
    optimizeDeps: { exclude: ['maplibre-gl'] },
    build: {
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        treeshake: true,
        output: {
          // Only the data layer is split out. Recharts and Leaflet are deliberately left to Rollup so they stay in the
          // lazy page chunks that use them instead of being preloaded from the entry (AUD-17).
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-aria') || id.includes('@react-aria')) {
                return 'reactAria';
              }
              if (id.includes('@hugeicons')) {
                return 'icons';
              }
              if (id.includes('/motion/') || id.includes('\\motion\\')) {
                return 'motion';
              }
              if (id.includes('@tanstack/react-query')) {
                return 'reactQuery';
              }
            }
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