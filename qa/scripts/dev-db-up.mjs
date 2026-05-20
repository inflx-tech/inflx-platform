#!/usr/bin/env node
'use strict';

/**
 * dev-db-up.mjs — bring up the persistent local-dev Postgres.
 * Idempotent (docker compose up -d is a no-op if already running).
 * Loud failure on Docker unavailable, port clash, or boot timeout.
 *
 * Contract: features/setup-local-dev-environment/
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PG_CONTAINER, PG_PORT, DEV_DATABASE_URL } from './dev-db-config.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWin = process.platform === 'win32';
const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: isWin, ...opts });

function fail(msg) { console.error(`[dev-db-up] FAIL — ${msg}`); process.exit(1); }

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function main() {
  if (sh('docker', ['ps']).status !== 0) {
    fail('Docker daemon not reachable. Start Docker Desktop and retry.');
  }

  const up = sh('docker', ['compose', '-f', 'docker-compose.dev.yml', 'up', '-d'], { cwd: REPO_ROOT });
  if (up.status !== 0) {
    const err = (up.stderr || up.stdout || '').toString();
    if (/port is already allocated|address already in use|bind.*5433/i.test(err)) {
      fail(`Port ${PG_PORT} already in use by a non-${PG_CONTAINER} process. ` +
           `Find the conflict: \`netstat -ano | findstr :${PG_PORT}\` (Windows) or ` +
           `\`lsof -iTCP:${PG_PORT}\`. Free the port or stop the conflicting service.`);
    }
    fail(`docker compose up failed:\n${err}`);
  }

  // Wait until pg_isready (≤60s).
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    const r = sh('docker', ['exec', PG_CONTAINER, 'pg_isready', '-U', 'postgres', '-d', 'inflx_dev']);
    if (r.status === 0) { ready = true; break; }
    sleep(1000);
  }
  if (!ready) {
    fail(`${PG_CONTAINER} did not accept connections within 60s. ` +
         `Check logs: \`docker logs ${PG_CONTAINER}\`.`);
  }

  console.log(`[dev-db-up] OK — ${PG_CONTAINER} ready @ localhost:${PG_PORT}`);
  console.log(`[dev-db-up] DATABASE_URL=${DEV_DATABASE_URL}`);
  console.log(`[dev-db-up] next: pnpm db:dev:init  (apply migrations; first time only)`);
}

main();
