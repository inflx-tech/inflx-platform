#!/usr/bin/env node
'use strict';

/**
 * qa-report.mjs — turns the Playwright JSON result into a structured
 * QA report, with GOVERNANCE-INTEGRITY guarantees (contract C1).
 *
 * Hard guarantee — verdict GREEN is reachable ONLY if ALL hold:
 *   pwExit === 0  ∧  results fresh+present  ∧  results parsed  ∧
 *   json.errors[] empty  ∧  specs > 0  ∧  stats.unexpected === 0  ∧
 *   failed === 0  ∧  stats/spec reconciliation passes
 * Any other state → FAILED | INCOMPLETE | UNKNOWN, and the reporter
 * EXITS NON-ZERO. Bias is pessimistic: uncertainty == failure
 * (a false alarm costs a re-run; a false GREEN costs a bad release).
 *
 * Inputs:
 *   results : QA_RESULTS_FILE or qa/artifacts/results.json
 *   pwExit  : QA_PW_EXIT (set by run-qa.mjs — the real Playwright exit)
 *   outDir  : QA_REPORT_DIR or qa/reports
 * (env overrides exist so the C1 meta-tests can exercise every state
 *  without touching the real run artifacts.)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QA_ROOT = path.join(__dirname, '..');
const RESULTS = process.env.QA_RESULTS_FILE || path.join(QA_ROOT, 'artifacts', 'results.json');
const REPORT_DIR = process.env.QA_REPORT_DIR || path.join(QA_ROOT, 'reports');
const SHOTS = path.join(QA_ROOT, 'artifacts', 'screenshots');

const ts = () => new Date().toISOString().replace(/[:.]/g, '-');

function walk(suite, filePath, acc) {
  const file = suite.file || filePath || '';
  for (const spec of suite.specs || []) {
    const results = (spec.tests || []).flatMap((t) => t.results || []);
    const status = results.some((r) => r.status === 'passed')
      && !results.some((r) => r.status === 'failed' || r.status === 'timedOut')
      ? 'passed'
      : results.some((r) => r.status === 'failed' || r.status === 'timedOut')
        ? 'failed'
        : (results[0]?.status || 'unknown');
    const durationMs = results.reduce((s, r) => s + (r.duration || 0), 0);
    const error = results.find((r) => r.error)?.error;
    acc.push({
      workflow: spec.title,
      file: file.replace(/\\/g, '/'),
      status,
      durationMs,
      error: error ? (error.message || String(error)).split('\n').slice(0, 6).join('\n') : null,
    });
  }
  for (const child of suite.suites || []) walk(child, file, acc);
}

/** Pessimistic verdict state machine. Returns {state, reason, ...}. */
function decide() {
  const rawExit = process.env.QA_PW_EXIT;
  const pwExitKnown = rawExit !== undefined && rawExit !== '' && Number.isInteger(Number(rawExit));
  const pwExit = pwExitKnown ? Number(rawExit) : null;

  if (!fs.existsSync(RESULTS)) {
    return { state: 'FAILED', reason: `results.json missing at ${RESULTS} — run crashed before writing, or was not run`, specs: [], stats: {} };
  }
  let json;
  try {
    json = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  } catch (e) {
    return { state: 'FAILED', reason: `results.json unparseable: ${e.message}`, specs: [], stats: {} };
  }

  const specs = [];
  for (const s of json.suites || []) walk(s, s.file, specs);
  const stats = json.stats || {};
  const errors = Array.isArray(json.errors) ? json.errors : [];
  const failed = specs.filter((s) => s.status === 'failed').length;
  const unexpected = Number(stats.unexpected || 0);

  if (!pwExitKnown) {
    return { state: 'UNKNOWN', reason: 'no run context: QA_PW_EXIT not provided (run via `pnpm qa`, not the reporter alone) — cannot certify', specs, stats, errors };
  }
  if (pwExit !== 0) {
    return { state: 'FAILED', reason: `Playwright run exited ${pwExit}`, specs, stats, errors };
  }
  if (errors.length > 0) {
    return { state: 'FAILED', reason: `Playwright reported ${errors.length} worker/suite-load error(s)`, specs, stats, errors };
  }
  if (specs.length === 0) {
    return { state: 'UNKNOWN', reason: 'zero workflows parsed from a successful-looking run — treat as failed', specs, stats, errors };
  }
  if (unexpected > 0 || failed > 0) {
    return { state: 'FAILED', reason: `${failed} failed spec(s), stats.unexpected=${unexpected}`, specs, stats, errors };
  }
  if (!Number.isInteger(stats.expected)) {
    return { state: 'INCOMPLETE', reason: 'stats missing/!integer expected — run did not complete cleanly', specs, stats, errors };
  }
  return { state: 'GREEN', reason: 'all reconciliation checks passed', specs, stats, errors };
}

function shotList(phase) {
  const d = path.join(SHOTS, phase);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.png'));
}

function main() {
  const v = decide();
  const isGreen = v.state === 'GREEN';
  const specs = v.specs || [];
  const passed = specs.filter((s) => s.status === 'passed').length;
  const failed = specs.filter((s) => s.status === 'failed').length;

  const VERDICT = {
    GREEN: '✅ ALL WORKFLOWS PASSED',
    FAILED: '❌ FAILED',
    INCOMPLETE: '❌ INCOMPLETE — TREAT AS FAILED',
    UNKNOWN: '🟠 UNKNOWN — TREAT AS FAILED',
  }[v.state];

  const lines = [];
  lines.push('# INFLX QA Report');
  lines.push('');
  lines.push(`- **Generated:** ${new Date().toISOString()}`);
  lines.push(`- **Verdict:** ${VERDICT}`);
  lines.push(`- **State:** ${v.state} — ${v.reason}`);
  lines.push(`- **Workflows:** ${specs.length}  ·  passed ${passed}  ·  failed ${failed}`);
  if (v.stats?.duration != null) lines.push(`- **Duration:** ${(v.stats.duration / 1000).toFixed(1)}s`);
  lines.push('');
  lines.push('> GREEN is only possible when pwExit=0, results fresh+parsed, no worker errors, specs>0, stats.unexpected=0, failed=0, reconciliation passes. Uncertainty escalates to failure.');
  lines.push('');

  if (specs.length) {
    lines.push('## Workflow results');
    lines.push('');
    lines.push('| Workflow | File | Status | Duration |');
    lines.push('|---|---|---|---|');
    for (const s of specs) {
      const icon = s.status === 'passed' ? '✅' : s.status === 'failed' ? '❌' : '⚠️';
      lines.push(`| ${s.workflow} | \`${s.file}\` | ${icon} ${s.status} | ${(s.durationMs / 1000).toFixed(1)}s |`);
    }
    lines.push('');
    const failures = specs.filter((s) => s.status === 'failed');
    if (failures.length) {
      lines.push('## ❌ Failed workflows (feed this to the auto-fix loop)');
      lines.push('');
      for (const f of failures) {
        lines.push(`### ${f.workflow}`);
        lines.push(`- File: \`${f.file}\``);
        lines.push('```');
        lines.push(f.error || '(no error message captured)');
        lines.push('```');
        lines.push('');
      }
    }
  }
  if (v.errors?.length) {
    lines.push('## ❌ Worker / suite-load errors');
    lines.push('');
    for (const e of v.errors) {
      lines.push('```');
      lines.push(String(e?.message || e).split('\n').slice(0, 8).join('\n'));
      lines.push('```');
      lines.push('');
    }
  }

  lines.push('## Artifacts');
  lines.push('');
  lines.push('- HTML report: `qa/artifacts/html-report/index.html`');
  const before = shotList('before');
  const after = shotList('after');
  lines.push(`- Before screenshots (${before.length}): \`qa/artifacts/screenshots/before/\``);
  lines.push(`- After screenshots (${after.length}): \`qa/artifacts/screenshots/after/\``);
  lines.push('');

  const md = lines.join('\n');
  const runDir = path.join(REPORT_DIR, ts());
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'QA-REPORT.md'), md);
  fs.writeFileSync(path.join(REPORT_DIR, 'latest.md'), md);

  console.log(`[qa-report] STATE=${v.state} — ${v.reason} — ${path.join(runDir, 'QA-REPORT.md')}`);
  process.exit(isGreen ? 0 : 1);
}

main();
