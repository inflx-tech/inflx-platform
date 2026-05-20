#!/usr/bin/env node
'use strict';

/**
 * qa-maestro.mjs — run all qa/maestro/flows/*.yaml via the maestro
 * CLI. Discovers flows in sorted order (numeric prefix), runs each
 * with output → qa/artifacts/qa-maestro/<timestamp>/<flow>/, prints
 * a summary, exits 0 ONLY if all flows passed.
 *
 * Prerequisite: maestro-doctor green (run as a guard if doctor not
 * yet passed; this script invokes it automatically before any test
 * run to avoid wasted attempts).
 *
 * Contract: features/maestro-infrastructure/
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWin = process.platform === 'win32';
const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: isWin, ...opts });

function fail(msg) { console.error(`[qa:maestro] FAIL — ${msg}`); process.exit(1); }
function info(msg) { console.log(`[qa:maestro] ${msg}`); }

// 1. Doctor must be green before we burn time on a Maestro run.
info(`running maestro-doctor (prerequisite) ...`);
const doc = sh('node', [path.join(REPO_ROOT, 'qa', 'scripts', 'maestro-doctor.mjs')], { stdio: 'inherit' });
if (doc.status !== 0) {
  fail(`maestro-doctor reported RED — fix the failures above before running qa:maestro.`);
}

// 2. Discover flows.
const flowsDir = path.join(REPO_ROOT, 'qa', 'maestro', 'flows');
if (!fs.existsSync(flowsDir)) fail(`qa/maestro/flows/ does not exist`);
const flows = fs.readdirSync(flowsDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort();
if (flows.length === 0) fail(`no .yaml files in qa/maestro/flows/`);

info(`discovered ${flows.length} flow${flows.length === 1 ? '' : 's'}: ${flows.join(', ')}`);

// 3. Output dir.
const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const outRoot = path.join(REPO_ROOT, 'qa', 'artifacts', 'qa-maestro', ts);
fs.mkdirSync(outRoot, { recursive: true });
info(`output → ${path.relative(REPO_ROOT, outRoot).replace(/\\/g, '/')}/`);

// 4. Run each flow.
const results = [];
for (const flow of flows) {
  const flowPath = path.join(flowsDir, flow);
  const base = flow.replace(/\.ya?ml$/, '');
  const flowOut = path.join(outRoot, base);
  fs.mkdirSync(flowOut, { recursive: true });

  info(`running ${base} ...`);
  const r = sh('maestro', ['test', '--format', 'junit',
                           '--output', path.join(flowOut, 'junit.xml'),
                           flowPath], {
    cwd: flowOut,                  // maestro writes screenshots to cwd
    stdio: 'inherit',
  });
  const passed = r.status === 0;
  results.push({ flow: base, passed, exit: r.status });
  info(`  ${base}: ${passed ? 'PASSED' : `FAILED (exit ${r.status})`}`);
}

// 5. Summary.
const passed = results.filter((r) => r.passed).length;
const total  = results.length;
console.log('');
if (passed === total) {
  info(`=== ${passed}/${total} flows PASSED ===`);
  process.exit(0);
} else {
  console.error(`[qa:maestro] === ${passed}/${total} flows passed; ${total - passed} FAILED ===`);
  for (const r of results.filter((x) => !x.passed)) {
    console.error(`             - ${r.flow} (exit ${r.exit})`);
  }
  process.exit(1);
}
