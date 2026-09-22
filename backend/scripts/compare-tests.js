#!/usr/bin/env node
'use strict';

/**
 * compare-tests.js — two Jest JSON runs, and what moved between them.
 * Contract: features/item11-remote · approval §3.17
 *
 * Item 10 used a throwaway version of this from scratch space, which meant the one artefact that
 * proves "no new failures" did not survive the item that produced it. It is committed now.
 *
 * Usage:
 *   node scripts/compare-tests.js baseline_item11.json after.json
 *   node scripts/compare-tests.js baseline_item11.json after.json --json
 *
 * Exit code 1 when anything is NEWLY FAILING — so it can gate a release. A test that was already
 * failing before the change is reported and does NOT fail the run: this repo carries ~220
 * pre-existing failures and the honest bar is "added none", never "all green".
 */

const fs = require('fs');

const [, , beforePath, afterPath, ...flags] = process.argv;
if (!beforePath || !afterPath) {
  console.error('Usage: node scripts/compare-tests.js <before.json> <after.json> [--json]');
  process.exit(2);
}
const asJson = flags.includes('--json');

/** Jest's JSON, flattened to fullName → status. A test's identity is its full name. */
function load(p) {
  if (!fs.existsSync(p)) { console.error(`Not found: ${p}`); process.exit(2); }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const byName = new Map();
  for (const suite of raw.testResults || []) {
    for (const t of suite.assertionResults || []) {
      // fullName can repeat across files (two suites, same describe+it). Key on the file too,
      // relative to the repo, so a rename is visible rather than silently matching.
      const file = String(suite.name || '').replace(/\\/g, '/').split('/backend/').pop();
      byName.set(`${file} :: ${t.fullName}`, t.status);
    }
  }
  return {
    byName,
    totals: {
      suites: raw.numTotalTestSuites || 0,
      suitesFailed: raw.numFailedTestSuites || 0,
      tests: raw.numTotalTests || 0,
      passed: raw.numPassedTests || 0,
      failed: raw.numFailedTests || 0,
      pending: raw.numPendingTests || 0,
    },
  };
}

const a = load(beforePath);
const b = load(afterPath);

const isFail = (s) => s === 'failed';

const newTests = [];
const goneTests = [];
const newlyFailing = [];
const newlyPassing = [];
const stillFailing = [];

for (const [name, status] of b.byName) {
  if (!a.byName.has(name)) {
    newTests.push({ name, status });
    if (isFail(status)) newlyFailing.push({ name, was: '(new)' });
    continue;
  }
  const was = a.byName.get(name);
  if (isFail(status) && !isFail(was)) newlyFailing.push({ name, was });
  else if (!isFail(status) && isFail(was)) newlyPassing.push({ name, was });
  else if (isFail(status) && isFail(was)) stillFailing.push({ name });
}
for (const [name] of a.byName) if (!b.byName.has(name)) goneTests.push({ name });

const summary = {
  before: a.totals,
  after: b.totals,
  newTests: newTests.length,
  newTestsPassing: newTests.filter((t) => !isFail(t.status)).length,
  newTestsFailing: newTests.filter((t) => isFail(t.status)).length,
  gone: goneTests.length,
  newlyFailing: newlyFailing.length,
  newlyPassing: newlyPassing.length,
  stillFailing: stillFailing.length,
  verdict: newlyFailing.length === 0 ? 'NO NEW FAILURES' : 'NEW FAILURES',
};

if (asJson) {
  console.log(JSON.stringify({ summary, newlyFailing, newlyPassing, newTests, goneTests }, null, 2));
} else {
  const line = (k, v) => console.log(`  ${String(k).padEnd(22)} ${v}`);
  console.log('\n── Before ──');
  line('suites', `${a.totals.suites} (${a.totals.suitesFailed} failed)`);
  line('tests', `${a.totals.tests}  passed ${a.totals.passed}  failed ${a.totals.failed}`);
  console.log('── After ──');
  line('suites', `${b.totals.suites} (${b.totals.suitesFailed} failed)`);
  line('tests', `${b.totals.tests}  passed ${b.totals.passed}  failed ${b.totals.failed}`);
  console.log('── Moved ──');
  line('new tests', `${summary.newTests} (${summary.newTestsPassing} passing, ${summary.newTestsFailing} failing)`);
  line('gone', summary.gone);
  line('newly failing', summary.newlyFailing);
  line('newly passing', summary.newlyPassing);
  line('still failing', summary.stillFailing);

  if (newlyFailing.length) {
    console.log('\n── NEWLY FAILING ──');
    for (const t of newlyFailing) console.log(`  ✗ ${t.name}   (was: ${t.was})`);
  }
  if (goneTests.length) {
    console.log('\n── GONE (renamed, moved or deleted — say which) ──');
    for (const t of goneTests) console.log(`  · ${t.name}`);
  }
  if (newlyPassing.length) {
    console.log('\n── NEWLY PASSING ──');
    for (const t of newlyPassing) console.log(`  ✓ ${t.name}`);
  }
  console.log(`\n${summary.verdict}\n`);
}

process.exit(newlyFailing.length === 0 ? 0 : 1);
