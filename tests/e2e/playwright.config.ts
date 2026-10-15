import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite for Crystal.
 *
 * Expects the stack to be running already (see tests/e2e/README.md):
 *   - backend  (server/src)  on :3001 against a real Postgres
 *   - frontend (vite preview) on :4173, proxying /api to :3001
 *
 * The app is addressed as crystal.localhost rather than localhost so the
 * client does not switch into its localhost-only "dev environment" mode
 * (App.tsx isDevEnvironment), matching a real self-hosted install.
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://crystal.localhost:4173';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  testIgnore: ['node_modules/**'],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'results/results.json' }]],
  outputDir: 'results/artifacts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    colorScheme: 'light',
  },
  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
});
