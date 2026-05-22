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

// Attach a diagnostic 'error' listener to the app pool at test startup so any
// Connection-terminated / unexpected pool error during the test surfaces with
// pool-state context (totalCount/idleCount/waitingCount), not just the bare
// message. Test-side instrumentation only — backend/src/config/db.js (governed)
// is untouched; its existing listener continues to fire alongside this one.
// Idempotent (guarded against re-attach if the file is loaded twice in the
// same worker process).
// Contract: features/qa-db-env-resilience.
beforeAll(() => {
  try {
    const { pool: appPool } = require('../src/config/db');
    if (appPool && !appPool._inflxDiagAttached) {
      appPool._inflxDiagAttached = true;
      appPool.on('error', (err) => {
        try {
          console.error(
            '[app-pool] Unexpected pool error:', err && err.message,
            '— pool state:', {
              total: appPool.totalCount,
              idle: appPool.idleCount,
              waiting: appPool.waitingCount,
            }
          );
        } catch (_) { /* never let diagnostic logging throw */ }
      });
    }
  } catch (_) { /* app pool not used by this file / not yet loaded */ }
});

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
