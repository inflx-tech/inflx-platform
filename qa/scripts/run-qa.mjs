#!/usr/bin/env node
'use strict';

/**
 * run-qa.mjs — the QA orchestrator (cross-platform; no shell chaining).
 *
 * 1. Runs the Playwright workflow suite (L1 API + L2 web).
 * 2. ALWAYS generates the structured QA report afterwards, pass or fail.
 * 3. Exits with Playwright's exit code, so CI / the release gate
 *    reflects WORKFLOW success — not compilation.
 *
 * Usage:  node qa/scripts/run-qa.mjs [-- <extra playwright args>]
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QA_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(QA_ROOT, '..');
const CONFIG = path.join(QA_ROOT, 'playwright.config.ts');

const extra = process.argv.slice(2);

console.log('[run-qa] Running workflow suite (Playwright)…');
const pw = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--config', CONFIG, ...extra],
  { cwd: REPO_ROOT, stdio: 'inherit', shell: process.platform === 'win32' },
);

console.log('[run-qa] Generating QA report…');
spawnSync('node', [path.join(QA_ROOT, 'scripts', 'qa-report.mjs')], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const code = pw.status == null ? 1 : pw.status;
console.log(`[run-qa] Done. Workflow exit code: ${code} (0 = all workflows passed).`);
process.exit(code);
