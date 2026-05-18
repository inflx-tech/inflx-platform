#!/usr/bin/env node
'use strict';

/**
 * qa-db.mjs — the SEPARATE B2b DB lane.
 * Contract: features/db-substrate/ (B2b).
 *
 * db-up → backend jest (globalSetup applies ALL 53 migrations) →
 * db-down (always) → write qa/artifacts/db-lane.json + own exit.
 *
 * NEVER merged into the main `pnpm qa` GREEN. No false-green:
 *   - Docker down / db-up fail            → laneState FAIL
 *   - a migration errors                  → laneState FAIL (names file)
 *   - jest can't start                    → laneState FAIL
 *   - jest ran but legacy tests failed    → laneState FAIL
 *       (substrate OK; failures are tracked findings, not hidden)
 *   - all green                           → laneState PASS
 * Exit 0 ONLY when laneState === PASS.
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_DATABASE_URL } from './db-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QA_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(QA_ROOT, '..');
const LANE_JSON = path.join(QA_ROOT, 'artifacts', 'db-lane.json');

const isWin = process.platform === 'win32';
const shOpts = { cwd: REPO_ROOT, encoding: 'utf8', shell: isWin };

function writeLane(o) {
  fs.mkdirSync(path.dirname(LANE_JSON), { recursive: true });
  fs.writeFileSync(LANE_JSON, JSON.stringify({ ...o, generatedAt: new Date().toISOString() }, null, 2));
}

function finish(lane) {
  writeLane(lane);
  const pass = lane.laneState === 'PASS';
  console.log(`[qa:db] DB-LANE=${lane.laneState} — ${lane.reason}`);
  process.exit(pass ? 0 : 1);
}

function nodeScript(rel) {
  return spawnSync('node', [path.join(QA_ROOT, 'scripts', rel)], { ...shOpts, stdio: 'inherit' });
}

function streamBackendJest() {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['--filter', 'inflx-backend', 'test'], {
      cwd: REPO_ROOT,
      shell: isWin,
      env: { ...process.env, TEST_DATABASE_URL },
    });
    let buf = '';
    const cap = (d) => { const s = d.toString(); buf += s; process.stdout.write(s); };
    child.stdout.on('data', cap);
    child.stderr.on('data', cap);
    child.on('close', (code) => resolve({ code: code == null ? 1 : code, out: buf }));
  });
}

async function main() {
  // 1. daemon reachable?
  if (spawnSync('docker', ['ps'], shOpts).status !== 0) {
    finish({ laneState: 'FAIL', substrate: 'FAIL_DOCKER', reason: 'Docker daemon not running', jest: { ran: false } });
  }

  // 2. db-up (deterministic clean container)
  if (nodeScript('db-up.mjs').status !== 0) {
    nodeScript('db-down.mjs');
    finish({ laneState: 'FAIL', substrate: 'FAIL_DOCKER', reason: 'db-up failed (see log above)', jest: { ran: false } });
  }

  // 3. backend jest (globalSetup migrates ALL 53), always tear down
  let res;
  try {
    console.log('[qa:db] running backend jest against the migrated DB (this can take a few minutes)…');
    res = await streamBackendJest();
  } finally {
    nodeScript('db-down.mjs');
  }

  const out = res.out;
  // Persist the full jest output for evidence-based triage
  // (Phase 2: no guessing from summary counts). Additive — does
  // not affect laneState/exit/C1.
  try {
    const logPath = path.join(QA_ROOT, 'artifacts', 'db-jest.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, out);
    console.log(`[qa:db] full jest output → ${logPath} (${out.length} bytes)`);
  } catch (e) {
    console.log(`[qa:db] WARN could not write db-jest.log: ${e.message}`);
  }

  const migMatch = out.match(/migrations applied:\s*(\d+)\/(\d+)/);
  const migFail = out.match(/MIGRATION FAILED at (\S+)/);
  const testsLine = out.match(/Tests:\s+(?:(\d+) failed,\s+)?(?:(\d+) skipped,\s+)?(?:(\d+) passed,\s+)?(\d+) total/);

  if (migFail) {
    finish({ laneState: 'FAIL', substrate: 'FAIL_MIGRATION', reason: `migration error at ${migFail[1]} — real finding, open a B2b-fix follow-up`, jest: { ran: false } });
  }
  if (/TEST_DATABASE_URL is not set/.test(out)) {
    finish({ laneState: 'FAIL', substrate: 'FAIL_JEST_START', reason: 'TEST_DATABASE_URL not seen by jest globalSetup', jest: { ran: false } });
  }
  if (!testsLine) {
    finish({ laneState: 'FAIL', substrate: 'FAIL_JEST_START', reason: 'backend jest did not execute to completion (no test summary)', jest: { ran: false }, migrationsApplied: migMatch ? Number(migMatch[1]) : null });
  }

  const failed = Number(testsLine[1] || 0);
  const passed = Number(testsLine[3] || 0);
  const total = Number(testsLine[4] || 0);
  const migrationsApplied = migMatch ? Number(migMatch[1]) : null;
  const migrationsTotal = migMatch ? Number(migMatch[2]) : null;
  const substrate = 'OK';
  const jest = { ran: true, passed, failed, total, exit: res.code };

  if (failed > 0) {
    finish({
      laneState: 'FAIL',
      substrate,
      reason: `substrate OK (migrations ${migrationsApplied}/${migrationsTotal}) but ${failed} backend test(s) failed — tracked legacy findings, NOT hidden, NOT a substrate failure`,
      migrationsApplied, migrationsTotal, jest,
      findings: `${failed} pre-existing backend jest failure(s) revealed by the now-correct full schema — catalogue into a follow-up contract`,
    });
  }

  finish({
    laneState: 'PASS',
    substrate,
    reason: `Docker up, ${migrationsApplied}/${migrationsTotal} migrations applied 0-error, backend jest ${passed}/${total} passed`,
    migrationsApplied, migrationsTotal, jest,
  });
}

main();
