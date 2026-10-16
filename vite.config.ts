import * as path from 'path';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'process';
import tailwindcss from "@tailwindcss/vite";

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

/**
 * Phosphor ships every icon with six weight variants and the app only ever renders "duotone" (Icon.tsx never passes
 * another weight). Dropping the other four from each icon definition
 * removes roughly two thirds of the icon payload from the entry chunk (AUD-16).
 */
const phosphorKeepWeights = (keep: string[]): PluginOption => ({
  name: 'phosphor-keep-weights',
  apply: 'build',
  enforce: 'pre',
  transform(code, id) {
    if (!/@phosphor-icons\/react\/dist\/defs\/[^/]+\.es\.js$/.test(id)) return null;
    const entry = /\n  \[\n    "(thin|light|regular|bold|fill|duotone)",[\s\S]*?\n  \],?/g;
    const next = code.replace(entry, (match, weight: string) => (keep.includes(weight) ? match : ''));
    return next === code ? null : { code: next, map: null };
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
    plugins: [
      phosphorKeepWeights(['duotone']),
      tailwindcss(),
      react(),
      shouldAnalyze && createBundleAnalyzerPlugin(),
    ].filter(Boolean) as PluginOption[],
    build: {
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        treeshake: true,
        output: {
          // Only the data layer is split out. Recharts and Leaflet are deliberately left to Rollup so they stay in the
          // lazy page chunks that use them instead of being preloaded from the entry (AUD-17).
          manualChunks: {
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