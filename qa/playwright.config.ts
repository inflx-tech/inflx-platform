import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * INFLX QA — Playwright config (L2 web E2E + L1 API workflow specs).
 *
 * Success criterion is WORKFLOW EXECUTION, not compilation: every spec
 * here drives real user behaviour and asserts the resulting state.
 *
 * Video is intentionally OFF — the FFmpeg CDN is blocked in this
 * environment, and screenshots + traces are the better QA artifact
 * anyway (inline-able in the QA report, smaller, deterministic).
 *
 * webServer auto-starts brand-web (Next 14, port 3002). The first
 * workflow stubs the API so it is deterministic with no live backend;
 * specs that need the real API set QA_LIVE_API=1 and skip the stub.
 */

const ROOT = path.join(__dirname, '..');

export default defineConfig({
  testDir: __dirname,
  testMatch: ['web/**/*.spec.ts', 'api/**/*.spec.ts'],
  outputDir: path.join(__dirname, 'artifacts', 'test-output'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, 'artifacts', 'html-report'), open: 'never' }],
    ['json', { outputFile: path.join(__dirname, 'artifacts', 'results.json') }],
  ],

  use: {
    baseURL: process.env.QA_BRAND_WEB_URL || 'http://localhost:3002',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    actionTimeout: 15_000,
  },

  projects: [
    { name: 'web-brand', use: { ...devices['Desktop Chrome'] } },
  ],

  // brand-web is NOT pnpm-workspace-managed (workspace glob is
  // lowercase `packages/*`, dirs are `Packages/*`), so start it
  // directly from its own node_modules — mirrors the working
  // root `dev:brand` script. Do not use `pnpm --filter` here.
  webServer: {
    command: 'npm run dev',
    cwd: path.join(ROOT, 'Packages', 'brand-web'),
    url: 'http://localhost:3002/login',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
