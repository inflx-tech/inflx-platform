#!/usr/bin/env node
'use strict';

/**
 * ai-eval.mjs — INFLX Meals X2 AI-eval lane.
 *
 * Scores the Meals intent extractor against a golden chat→intent set
 * with field-level tolerance. INFORMATIONAL like qa:db — it prints a
 * pass rate and ALWAYS exits 0; it never gates the main GREEN. It is
 * the safety net for the non-deterministic AI layer: run it after any
 * prompt/model change to catch extraction drift.
 *
 * Locally it scores ai/mock.js (deterministic). To score the live model
 * instead, run with AI_MOCK=false + ANTHROPIC_API_KEY (the extractor
 * dispatches automatically).
 *
 * Contract: features/meals-ai/.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const require = createRequire(path.join(ROOT, 'backend', 'package.json'));

// Load backend env so the AI dispatcher's config validation passes when
// run standalone (the mock path needs no real services).
require('dotenv').config({ path: path.join(ROOT, 'backend', '.env') });

const ai = require(path.join(ROOT, 'backend', 'src', 'services', 'ai', 'index.js'));
const golden = JSON.parse(fs.readFileSync(path.join(ROOT, 'qa', 'ai-eval', 'golden-intents.json'), 'utf8'));

const TAG = '[ai-eval]';
const threshold = golden.pass_threshold_per_case ?? 0.8;

function scoreCase(expected, got) {
  const fields = Object.keys(expected).filter((k) => k !== 'expects_clarify');
  let matched = 0;
  let total = 0;
  const misses = [];
  for (const f of fields) {
    total += 1;
    const e = expected[f];
    const g = got[f];
    let ok;
    if (f === 'budget_per_head' && e != null && g != null) ok = Math.abs(Number(g) - Number(e)) <= Number(e) * 0.1;
    else ok = JSON.stringify(g ?? null) === JSON.stringify(e ?? null);
    if (ok) matched += 1; else misses.push(`${f}: expected ${JSON.stringify(e)}, got ${JSON.stringify(g ?? null)}`);
  }
  // clarify expectation
  if (expected.expects_clarify !== undefined) {
    total += 1;
    const gotClarify = !!got.clarify_question;
    if (gotClarify === expected.expects_clarify) matched += 1;
    else misses.push(`clarify: expected ${expected.expects_clarify}, got ${gotClarify}`);
  }
  return { score: total ? matched / total : 1, matched, total, misses };
}

async function main() {
  console.log(`${TAG} mode=${ai.isMock() ? 'mock (deterministic)' : 'live model'} · ${golden.cases.length} golden cases · per-case threshold ${threshold}`);
  let passed = 0;
  let scoreSum = 0;
  for (const c of golden.cases) {
    const got = await ai.extractIntent(c.input, { memory: c.memory || {} });
    const { score, matched, total, misses } = scoreCase(c.expect, got);
    scoreSum += score;
    const ok = score >= threshold;
    if (ok) passed += 1;
    console.log(`${TAG}   ${ok ? '✓' : '✗'} ${(score * 100).toFixed(0).padStart(3)}% (${matched}/${total})  ${c.name}`);
    if (!ok) misses.forEach((m) => console.log(`${TAG}        ↳ ${m}`));
  }
  const avg = (scoreSum / golden.cases.length) * 100;
  console.log(`${TAG} ─────────────────────────────────────────────`);
  console.log(`${TAG} cases passed: ${passed}/${golden.cases.length} · avg field score: ${avg.toFixed(1)}%`);
  console.log(`${TAG} INFORMATIONAL — exit 0 always (does not gate the main GREEN).`);
  process.exit(0);
}

main().catch((e) => { console.error(`${TAG} runner error (non-gating): ${e.message}`); process.exit(0); });
