#!/usr/bin/env node
'use strict';

/**
 * diff-open.mjs — full diff pipeline: before + after (best-effort) +
 * build + open in default browser.
 *
 * Usage: pnpm diff:open [<slug>]
 *        default slug = _demo-preview (the showcase contract)
 *
 * Contract: features/before-after-diff/
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const slug = process.argv[2] || '_demo-preview';

function run(script, label) {
  const r = spawnSync('node',
    [path.join(REPO_ROOT, 'qa', 'scripts', script), slug],
    { stdio: 'inherit' }
  );
  return r.status === 0;
}

// 1. Capture the locked mockups (required).
if (!run('diff-before.mjs', 'before')) process.exit(1);

// 2. Capture the live implementation (best-effort — diff-after exits
//    0 on "no captures configured" or "dev stack down per-mockup").
run('diff-after.mjs', 'after');

// 3. Assemble the page.
if (!run('diff-build.mjs', 'build')) process.exit(1);

// 4. Open in default browser.
const indexPath = path.join(REPO_ROOT, 'qa', 'artifacts', 'diff', slug, 'index.html');
const fileUrl = 'file:///' + indexPath.replace(/\\/g, '/');
console.log(`[diff-open] opening ${fileUrl}`);

let open;
if (isWin) {
  open = spawnSync('cmd', ['/c', 'start', '""', indexPath], { stdio: 'inherit' });
} else if (isMac) {
  open = spawnSync('open', [indexPath], { stdio: 'inherit' });
} else {
  open = spawnSync('xdg-open', [indexPath], { stdio: 'inherit' });
}
if (open.status !== 0) {
  console.error(`[diff-open] WARN — could not open browser automatically.`);
  console.error(`             open this manually: ${fileUrl}`);
  process.exit(0);
}
