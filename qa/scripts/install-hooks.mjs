#!/usr/bin/env node
'use strict';

/**
 * install-hooks.mjs — copy tracked git hooks into .git/hooks.
 *
 * .git/hooks is NOT version-controlled, so the canonical hooks live
 * tracked in qa/hooks/ and this installer materialises them. Idempotent,
 * cross-platform, zero dependencies. Run via: `pnpm run hooks:install`.
 *
 * Contract: features/governance-enforcement-ci/ (GOVERNANCE.md §11).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function gitDir() {
  try {
    return execFileSync('git', ['rev-parse', '--git-dir'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return path.join(REPO_ROOT, '.git');
  }
}

const HOOKS_SRC = path.join(REPO_ROOT, 'qa', 'hooks');
const gd = gitDir();
const HOOKS_DST = path.isAbsolute(gd) ? path.join(gd, 'hooks') : path.join(REPO_ROOT, gd, 'hooks');

if (!fs.existsSync(HOOKS_SRC)) {
  console.error(`[hooks:install] no qa/hooks dir — nothing to install`);
  process.exit(1);
}
fs.mkdirSync(HOOKS_DST, { recursive: true });

let n = 0;
for (const name of fs.readdirSync(HOOKS_SRC)) {
  const src = path.join(HOOKS_SRC, name);
  if (!fs.statSync(src).isFile()) continue;
  const dst = path.join(HOOKS_DST, name);
  fs.copyFileSync(src, dst);
  try { fs.chmodSync(dst, 0o755); } catch { /* windows: ignore */ }
  console.log(`[hooks:install] ${name} → ${path.relative(REPO_ROOT, dst)}`);
  n++;
}
console.log(`[hooks:install] done — ${n} hook(s) installed. Local layer active (advisory; CI is the gate).`);
