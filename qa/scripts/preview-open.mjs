#!/usr/bin/env node
'use strict';

/**
 * preview-open.mjs — build a contract preview and open it in the
 * default browser.
 *
 * Usage: pnpm preview:open [<slug>]
 *        default slug = _demo-preview (the showcase contract)
 *
 * Contract: features/preview-machinery/
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const slug = process.argv[2] || '_demo-preview';

// 1. Build.
const build = spawnSync('node', [path.join(REPO_ROOT, 'qa', 'scripts', 'preview-build.mjs'), slug],
  { encoding: 'utf8', stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);

// 2. Open.
const indexPath = path.join(REPO_ROOT, 'qa', 'artifacts', 'preview', slug, 'index.html');
const fileUrl = 'file:///' + indexPath.replace(/\\/g, '/');
console.log(`[preview-open] opening ${fileUrl}`);

let open;
if (isWin) {
  // `start` is a cmd built-in; first quoted arg is the window title.
  open = spawnSync('cmd', ['/c', 'start', '""', indexPath], { stdio: 'inherit' });
} else if (isMac) {
  open = spawnSync('open', [indexPath], { stdio: 'inherit' });
} else {
  open = spawnSync('xdg-open', [indexPath], { stdio: 'inherit' });
}
if (open.status !== 0) {
  console.error(`[preview-open] WARN — could not open browser automatically (exit ${open.status}).`);
  console.error(`             open this manually: ${fileUrl}`);
  process.exit(0); // build succeeded; opening is best-effort
}
