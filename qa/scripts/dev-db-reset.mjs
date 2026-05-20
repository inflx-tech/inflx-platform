#!/usr/bin/env node
'use strict';

/**
 * dev-db-reset.mjs — DESTROY the dev DB (container + volume) and
 * recreate from scratch (up + init). Destructive — wipes ALL local
 * dev data. Use when you want a clean baseline.
 *
 * Contract: features/setup-local-dev-environment/
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PG_CONTAINER, PG_VOLUME } from './dev-db-config.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWin = process.platform === 'win32';
const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: isWin, stdio: 'inherit', ...opts });

console.log(`[dev-db-reset] destroying ${PG_CONTAINER} + volume ${PG_VOLUME} ...`);
sh('docker', ['compose', '-f', 'docker-compose.dev.yml', 'down', '-v'], { cwd: REPO_ROOT });

console.log(`[dev-db-reset] bringing up a fresh container ...`);
const up = sh('node', ['qa/scripts/dev-db-up.mjs'], { cwd: REPO_ROOT });
if (up.status !== 0) { console.error(`[dev-db-reset] FAIL — dev-db-up exited ${up.status}`); process.exit(up.status || 1); }

console.log(`[dev-db-reset] applying migrations ...`);
const init = sh('node', ['qa/scripts/dev-db-init.mjs'], { cwd: REPO_ROOT });
if (init.status !== 0) { console.error(`[dev-db-reset] FAIL — dev-db-init exited ${init.status}`); process.exit(init.status || 1); }

console.log(`[dev-db-reset] DONE — fresh, migrated dev DB ready.`);
