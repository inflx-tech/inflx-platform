import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * WORKFLOW: C1 — QA aggregation fidelity (governance integrity).
 * Contract: features/qa-aggregation-fidelity/ (locked 2026-05-18).
 *
 * Runs qa-report.mjs as a subprocess against crafted run states.
 * The governance guarantee: GREEN (exit 0) is reachable ONLY when
 * the run is genuinely, completely, verifiably passed. Every
 * uncertainty state must be non-green AND exit non-zero. These
 * meta-tests are themselves the regression guard for that guarantee.
 */

const REPORTER = path.resolve('qa/scripts/qa-report.mjs');

function passedJson() {
  return {
    suites: [
      { file: 'x.spec.ts', specs: [{ title: 'wf-ok', tests: [{ results: [{ status: 'passed', duration: 10 }] }] }] },
    ],
    stats: { expected: 1, unexpected: 0, duration: 1000 },
    errors: [],
  };
}

/** Run the reporter with crafted env; return { code, out, state }. */
function runReporter(opts: { results?: unknown | 'MISSING' | string; pwExit?: string }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-c1-'));
  const resultsFile = path.join(dir, 'results.json');
  if (opts.results === 'MISSING') {
    /* leave absent */
  } else if (typeof opts.results === 'string') {
    fs.writeFileSync(resultsFile, opts.results); // raw (e.g. malformed)
  } else {
    fs.writeFileSync(resultsFile, JSON.stringify(opts.results));
  }
  const env: Record<string, string> = {
    ...process.env,
    QA_RESULTS_FILE: resultsFile,
    QA_REPORT_DIR: path.join(dir, 'reports'),
  };
  if (opts.pwExit !== undefined) env.QA_PW_EXIT = opts.pwExit;
  else delete env.QA_PW_EXIT;

  const r = spawnSync('node', [REPORTER], { env, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const m = out.match(/STATE=([A-Z]+)/);
  return { code: r.status, out, state: m ? m[1] : '(none)' };
}

test.describe('WORKFLOW: C1 QA aggregation fidelity', () => {
  test('S1 — passed results but Playwright exit=1 → not green, escalated', () => {
    const r = runReporter({ results: passedJson(), pwExit: '1' });
    expect(r.state).toBe('FAILED');
    expect(r.code, `exit=${r.code} out=${r.out}`).not.toBe(0);
  });

  test('S2 — worker/suite-load errors present → not green, escalated', () => {
    const j = passedJson();
    (j as any).errors = [{ message: 'worker process exited unexpectedly' }];
    const r = runReporter({ results: j, pwExit: '0' });
    expect(r.state).toBe('FAILED');
    expect(r.code).not.toBe(0);
  });

  test('S3 — stats.unexpected>0 → not green, escalated', () => {
    const j = passedJson();
    (j as any).stats.unexpected = 2;
    const r = runReporter({ results: j, pwExit: '0' });
    expect(r.state).toBe('FAILED');
    expect(r.code).not.toBe(0);
  });

  test('S3i — stats missing integer expected → INCOMPLETE, escalated', () => {
    const j = passedJson();
    delete (j as any).stats.expected;
    const r = runReporter({ results: j, pwExit: '0' });
    expect(r.state).toBe('INCOMPLETE');
    expect(r.code).not.toBe(0);
  });

  test('S4a — results.json missing → not green, escalated (not exit 0)', () => {
    const r = runReporter({ results: 'MISSING', pwExit: '0' });
    expect(r.state).toBe('FAILED');
    expect(r.code).not.toBe(0);
  });

  test('S4b — results.json malformed → not green, escalated', () => {
    const r = runReporter({ results: '{ this is not json', pwExit: '0' });
    expect(r.state).toBe('FAILED');
    expect(r.code).not.toBe(0);
  });

  test('S5 — no run context (QA_PW_EXIT unset) → UNKNOWN, escalated', () => {
    const r = runReporter({ results: passedJson() }); // pwExit omitted
    expect(r.state).toBe('UNKNOWN');
    expect(r.code).not.toBe(0);
  });

  test('S6 — zero specs from a "successful" run → UNKNOWN, escalated', () => {
    const r = runReporter({ results: { suites: [], stats: { expected: 0 }, errors: [] }, pwExit: '0' });
    expect(r.state).toBe('UNKNOWN');
    expect(r.code).not.toBe(0);
  });

  test('G1 — genuine green (fresh, passed, exit 0, consistent) → GREEN, exit 0', () => {
    const r = runReporter({ results: passedJson(), pwExit: '0' });
    expect(r.state, `out=${r.out}`).toBe('GREEN');
    expect(r.code).toBe(0);
  });

  test('G2 — genuine failure (failed spec, exit 1) → FAILED, escalated', () => {
    const j = {
      suites: [{ file: 'y.spec.ts', specs: [{ title: 'wf-bad', tests: [{ results: [{ status: 'failed', duration: 5, error: { message: 'boom' } }] }] }] }],
      stats: { expected: 0, unexpected: 1, duration: 500 },
      errors: [],
    };
    const r = runReporter({ results: j, pwExit: '1' });
    expect(r.state).toBe('FAILED');
    expect(r.code).not.toBe(0);
  });
});
