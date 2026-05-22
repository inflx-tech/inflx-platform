#!/usr/bin/env node
'use strict';

/**
 * db-up.mjs — bring up an ephemeral Postgres for the B2b DB lane.
 * Deterministic: removes any prior same-named container first
 * (clean slate), pins the image, uses a NON-default host port so it
 * can never silently collide with a real local Postgres. Loud fail
 * on any problem — never a silent reuse of an unknown DB.
 *
 * Contract: features/db-substrate/ (B2b).
 */

import { spawnSync } from 'node:child_process';
import { PG_CONTAINER, PG_IMAGE, PG_PORT, TEST_DATABASE_URL } from './db-config.mjs';

const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts });

// Blocking sleep (sync script, no event loop to yield to here).
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function fail(msg) {
  console.error(`[db-up] FAIL — ${msg}`);
  process.exit(1);
}

function main() {
  // 0. daemon reachable?
  if (sh('docker', ['ps']).status !== 0) fail('Docker daemon not running (docker ps failed)');

  // 1. deterministic reset — remove any prior container
  sh('docker', ['rm', '-f', PG_CONTAINER]);

  // 2. start fresh
  //    -c max_connections=200 — bumped from postgres default 100 to give
  //    jest worker pools + helper pool + app pool collective headroom under
  //    sustained qa:db load. Contract: features/qa-db-env-resilience.
  //    Memory cost on the 7.5GB Docker RAM limit is negligible (~few KB per
  //    connection slot).
  const run = sh('docker', [
    'run', '-d', '--name', PG_CONTAINER,
    '-e', 'POSTGRES_PASSWORD=qa',
    '-e', 'POSTGRES_DB=inflx_test',
    '-p', `${PG_PORT}:5432`,
    PG_IMAGE,
    '-c', 'max_connections=200',
  ]);
  if (run.status !== 0) {
    fail(`docker run failed (port ${PG_PORT} clash? image pull failure?):\n${run.stderr || run.stdout}`);
  }

  // 3. wait until Postgres accepts connections (≤60s)
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    const r = sh('docker', ['exec', PG_CONTAINER, 'pg_isready', '-U', 'postgres', '-d', 'inflx_test']);
    if (r.status === 0) { ready = true; break; }
    sleep(1000);
  }
  if (!ready) {
    sh('docker', ['rm', '-f', PG_CONTAINER]);
    fail('Postgres did not become ready within 60s — container removed');
  }

  console.log(`[db-up] DB ready @ localhost:${PG_PORT} (${PG_CONTAINER}, ${PG_IMAGE})`);
  console.log(`[db-up] TEST_DATABASE_URL=${TEST_DATABASE_URL}`);
}

main();
