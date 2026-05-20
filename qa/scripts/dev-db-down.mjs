#!/usr/bin/env node
'use strict';

/**
 * dev-db-down.mjs — stop the dev Postgres container.
 * KEEPS the persistent volume (inflx-dev-pgdata) so data survives.
 * For full destruction use pnpm db:dev:reset.
 *
 * Contract: features/setup-local-dev-environment/
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PG_CONTAINER } from './dev-db-config.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWin = process.platform === 'win32';
const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: isWin, stdio: 'inherit', ...opts });

const r = sh('docker', ['compose', '-f', 'docker-compose.dev.yml', 'stop'], { cwd: REPO_ROOT });
if (r.status !== 0) {
  console.error(`[dev-db-down] FAIL — docker compose stop exit ${r.status}`);
  process.exit(1);
}
console.log(`[dev-db-down] ${PG_CONTAINER} stopped — volume preserved. Restart: pnpm db:dev:up`);
