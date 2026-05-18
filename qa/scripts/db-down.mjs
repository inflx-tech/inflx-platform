#!/usr/bin/env node
'use strict';

/**
 * db-down.mjs — remove the ephemeral B2b Postgres container.
 * Idempotent; always safe to call (even if nothing is running).
 */

import { spawnSync } from 'node:child_process';
import { PG_CONTAINER } from './db-config.mjs';

const r = spawnSync('docker', ['rm', '-f', PG_CONTAINER], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
console.log(
  r.status === 0
    ? `[db-down] removed ${PG_CONTAINER}`
    : `[db-down] ${PG_CONTAINER} not present (nothing to remove)`,
);
