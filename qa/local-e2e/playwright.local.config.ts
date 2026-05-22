import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * LOCAL-ONLY E2E config — NOT part of `pnpm qa`.
 *
 * The main qa lane (qa/playwright.config.ts) matches web/api/unit only,
 * so this qa/local-e2e/ dir is invisible to it. These specs run against
 * the REAL local stack (backend :3001 + brand-web :3002 + dev DB :5433)
 * that `pnpm dev:all` brings up — they require seeded data
 * (qa/scripts/seed-conversion-e2e.mjs) and are run explicitly via
 * `pnpm qa:e2e:conversion`. They are NOT deterministic-stubbed and must
 * never gate CI.
 *
 * screenshot:'on' — we want the full filmstrip, not just on-failure.
 */
export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/*.spec.ts'],
  outputDir: path.join(__dirname, '..', 'artifacts', 'local-e2e-output'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.QA_BRAND_WEB_URL || 'http://localhost:3002',
    screenshot: 'on',
    trace: 'retain-on-failure',
    video: 'off',
    actionTimeout: 20_000,
  },
  projects: [{ name: 'local-brand', use: { ...devices['Desktop Chrome'] } }],
  // No webServer: the stack is already running via `pnpm dev:all`.
});
