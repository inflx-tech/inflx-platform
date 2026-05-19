'use strict';

/**
 * Per-test-file teardown (Jest `setupFilesAfterEnv`).
 *
 * Runs inside each worker/file's own module sandbox, AFTER the test
 * framework is installed — the only place that can close the
 * pg connection pools created INSIDE the worker (Jest's
 * globalSetup/globalTeardown run in a separate process and
 * structurally cannot).
 *
 * Closing both pools removes the leaked TCPWRAP handles that
 * forced `--forceExit` and caused load-sensitive timeout
 * nondeterminism in the qa:db lane.
 *
 *   1. tests/helpers/db.js  Pool (max 5)  — the test query/truncate pool
 *   2. src/config/db.js     Pool (max 20) — the app runtime pool, opened
 *                                           when a test require()s the app
 *
 * Idempotent + guarded: only ends a pool that exists and is not
 * already ending/ended; never throws out of teardown. NOT a mask —
 * it closes the real handles so Jest exits on its own.
 *
 * Contract: features/qa-db-determinism/
 */

afterAll(async () => {
  // 1. test-helper pool
  try {
    const { pool, closePool } = require('./helpers/db');
    if (pool && !pool.ended && !pool.ending) {
      await closePool();
    }
  } catch (_) { /* not used by this file / already closed */ }

  // 2. app runtime pool (held alive when the file require()s the app)
  try {
    const { pool } = require('../src/config/db');
    if (pool && !pool.ended && !pool.ending) {
      await pool.end();
    }
  } catch (_) { /* not used by this file / already closed */ }
});
