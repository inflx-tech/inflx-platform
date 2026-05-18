#!/usr/bin/env node
'use strict';

/**
 * qa-report.mjs — turns the Playwright JSON result into a structured,
 * human + agent readable QA report.
 *
 * Philosophy: a workflow is "successful" only when it EXECUTES, not
 * when it compiles. This report is organised around workflows
 * (specs), their pass/fail, the error if failed, and links to the
 * before/after screenshots + trace so the auto-fix loop (and you)
 * can act on it.
 *
 * Input :  qa/artifacts/results.json   (Playwright json reporter)
 * Output:  qa/reports/<timestamp>/QA-REPORT.md   (+ latest.md pointer)
 *
 * Exit code is always 0 — this is a reporter. Workflow pass/fail
 * gating is the Playwright run's own exit code (see run-qa.mjs).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QA_ROOT = path.join(__dirname, '..');
const RESULTS = path.join(QA_ROOT, 'artifacts', 'results.json');
const SHOTS = path.join(QA_ROOT, 'artifacts', 'screenshots');

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

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

function main() {
  if (!fs.existsSync(RESULTS)) {
    console.error(`[qa-report] No results at ${RESULTS} — run the QA suite first (pnpm qa).`);
    process.exit(0);
  }

  const json = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  const specs = [];
  for (const s of json.suites || []) walk(s, s.file, specs);

  const stats = json.stats || {};
  const passed = specs.filter((s) => s.status === 'passed').length;
  const failed = specs.filter((s) => s.status === 'failed').length;
  const other = specs.length - passed - failed;
  const allGreen = failed === 0 && specs.length > 0;

  const runDir = path.join(QA_ROOT, 'reports', ts());
  fs.mkdirSync(runDir, { recursive: true });

  const shotList = (phase) => {
    const d = path.join(SHOTS, phase);
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((f) => f.endsWith('.png'));
  };

  const lines = [];
  lines.push(`# INFLX QA Report`);
  lines.push('');
  lines.push(`- **Generated:** ${new Date().toISOString()}`);
  lines.push(`- **Verdict:** ${allGreen ? '✅ ALL WORKFLOWS PASSED' : failed > 0 ? '❌ WORKFLOW FAILURES' : '⚠️ NO WORKFLOWS RAN'}`);
  lines.push(`- **Workflows:** ${specs.length}  ·  passed ${passed}  ·  failed ${failed}  ·  other ${other}`);
  if (stats.duration != null) lines.push(`- **Duration:** ${(stats.duration / 1000).toFixed(1)}s`);
  lines.push('');
  lines.push(`> Success = workflow executed to its expected end state, not "code compiled".`);
  lines.push('');

  lines.push(`## Workflow results`);
  lines.push('');
  lines.push(`| Workflow | File | Status | Duration |`);
  lines.push(`|---|---|---|---|`);
  for (const s of specs) {
    const icon = s.status === 'passed' ? '✅' : s.status === 'failed' ? '❌' : '⚠️';
    lines.push(`| ${s.workflow} | \`${s.file}\` | ${icon} ${s.status} | ${(s.durationMs / 1000).toFixed(1)}s |`);
  }
  lines.push('');

  const failures = specs.filter((s) => s.status === 'failed');
  if (failures.length) {
    lines.push(`## ❌ Failed workflows (feed this to the auto-fix loop)`);
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

  lines.push(`## Artifacts`);
  lines.push('');
  lines.push(`- HTML report: \`qa/artifacts/html-report/index.html\``);
  lines.push(`- Traces (on failure): \`qa/artifacts/test-output/\``);
  const before = shotList('before');
  const after = shotList('after');
  lines.push(`- Before screenshots (${before.length}): \`qa/artifacts/screenshots/before/\``);
  before.forEach((f) => lines.push(`  - ${f}`));
  lines.push(`- After screenshots (${after.length}): \`qa/artifacts/screenshots/after/\``);
  after.forEach((f) => lines.push(`  - ${f}`));
  lines.push('');

  const md = lines.join('\n');
  fs.writeFileSync(path.join(runDir, 'QA-REPORT.md'), md);
  fs.writeFileSync(path.join(QA_ROOT, 'reports', 'latest.md'), md);

  console.log(`[qa-report] ${allGreen ? 'ALL GREEN' : failed > 0 ? `${failed} FAILED` : 'NO TESTS'} — ${path.relative(path.join(QA_ROOT, '..'), path.join(runDir, 'QA-REPORT.md'))}`);
  process.exit(0);
}

main();
