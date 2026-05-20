#!/usr/bin/env node
'use strict';

/**
 * governance-check.mjs — the single reusable governance validator.
 *
 * One source of truth, invoked by BOTH:
 *   - the local pre-push hook  (qa/hooks/pre-push)
 *   - CI                       (.github/workflows/qa.yml, `governance` job)
 *
 * It enforces, from GOVERNANCE.md:
 *   §1/§4  governed-path code requires an APPROVED contract
 *   §5     a release (lock.json release.released=true) requires a
 *          populated, self-consistent release/QA-evidence block
 *
 * Zero dependencies (node builtins + `git` only) so it cannot rot.
 * Deterministic: same tree + same base → same verdict.
 *
 * Exit: 0 compliant · 1 governance violation · 2 internal error.
 * Override: GOVERNANCE_OVERRIDE="reason" — allowed, printed LOUDLY,
 *           never silent (GOVERNANCE.md §8/§11).
 *
 * Contract: features/governance-enforcement-ci/
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARGS = process.argv.slice(2);
const CI = ARGS.includes('--ci') || !!process.env.CI;
const TAG = '[gov-check]';

function log(m) { console.log(`${TAG} ${m}`); }
function die(code, m) { (code === 0 ? console.log : console.error)(`${TAG} ${m}`); process.exit(code); }

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}
function gitSafe(args, fallback = '') {
  try { return git(args); } catch { return fallback; }
}

// ── Governed vs deploy-inert classification (GOVERNANCE.md §7) ──────────────
// Governed = `git push` can change production behaviour → contract required.
const GOVERNED = [
  /^backend\/src\//,
  /^backend\/migrations\//,
  /^Packages\/[^/]+\/(src|app|components|lib|screens|services)\//,
];
// UI_GOVERNED = subset of GOVERNED that needs mockup-lock + 06-diff/notes.md
// (Phase 2 sub-contract 5; GOVERNANCE.md §4a + §4b).
const UI_GOVERNED = [
  /^Packages\/[^/]+\/(src|app|components|lib|screens|services)\//,
];
// MOBILE_GOVERNED = subset of UI_GOVERNED that also needs Maestro green
// (Phase 2 sub-contract 5; GOVERNANCE.md §10).
const MOBILE_GOVERNED = [
  /^Packages\/Mobile\/src\//,
];
// Deploy-inert allowlist — never requires a contract.
const ALLOWLIST = [
  /^features\//, /^qa\//, /^docs\//, /^\.github\//, /^design\//,
  /^[^/]+\.md$/, /^GOVERNANCE\.md$/, /^CLAUDE\.md$/,
  /^backend\/seeds\/.*_draft\.csv$/,
  /^package\.json$/, /^pnpm-lock\.yaml$/, /^pnpm-workspace\.yaml$/,
  /^\.gitignore$/, /^Packages\/[^/]+\/(package\.json|package-lock\.json)$/,
];
const isGoverned = (f) => GOVERNED.some((r) => r.test(f)) && !ALLOWLIST.some((r) => r.test(f));
const isUiGoverned     = (f) => UI_GOVERNED.some((r) => r.test(f))     && !ALLOWLIST.some((r) => r.test(f));
const isMobileGoverned = (f) => MOBILE_GOVERNED.some((r) => r.test(f)) && !ALLOWLIST.some((r) => r.test(f));

// ── Base ref resolution (deterministic, defensive) ─────────────────────────
function resolveBase() {
  if (process.env.GOV_BASE) return process.env.GOV_BASE;
  // CI PR: GitHub provides the base sha via env.
  if (process.env.GITHUB_BASE_REF) {
    const b = gitSafe(['merge-base', `origin/${process.env.GITHUB_BASE_REF}`, 'HEAD']);
    if (b) return b;
  }
  // Normal: merge-base with origin/main.
  const mb = gitSafe(['merge-base', 'origin/main', 'HEAD']);
  if (mb) return mb;
  // Fallbacks: previous commit, else empty tree (whole repo).
  const prev = gitSafe(['rev-parse', 'HEAD~1']);
  return prev || git(['hash-object', '-t', 'tree', '/dev/null']);
}

function changedFiles(base) {
  const out = gitSafe(['diff', '--name-only', `${base}`, 'HEAD']);
  return out ? out.split('\n').map((s) => s.trim()).filter(Boolean) : [];
}

// ── Approved-contract index ────────────────────────────────────────────────
function approvedContracts() {
  const dir = path.join(REPO_ROOT, 'features');
  if (!fs.existsSync(dir)) return new Map();
  const map = new Map();
  for (const slug of fs.readdirSync(dir)) {
    if (slug.startsWith('_')) continue;
    const fdir = path.join(dir, slug);
    const lockP = path.join(fdir, 'lock.json');
    if (!fs.existsSync(lockP)) continue;
    let lock;
    try { lock = JSON.parse(fs.readFileSync(lockP, 'utf8')); } catch { continue; }
    const need = ['01-spec.md', '02-workflow.md', '05-impact.md'];
    const complete = need.every((n) => {
      const p = path.join(fdir, n);
      return fs.existsSync(p) && fs.readFileSync(p, 'utf8').trim().length > 0;
    });
    map.set(slug, { approved: lock.approved === true, complete, lock });
  }
  return map;
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  log(`mode=${CI ? 'ci' : 'local'} root=${path.basename(REPO_ROOT)}`);
  const base = resolveBase();
  const changed = changedFiles(base);
  if (changed.length === 0) die(0, `OK — no committed changes vs base. exit 0`);

  log(`scanning ${changed.length} changed path(s) vs ${base.slice(0, 12)}…`);
  const governed = changed.filter(isGoverned);
  const contracts = approvedContracts();

  // 1. Governed code requires an approved+complete contract touched in the
  //    same changeset (the unambiguous association rule).
  if (governed.length > 0) {
    const touchedApproved = changed
      .map((f) => /^features\/([^/]+)\/lock\.json$/.exec(f))
      .filter(Boolean)
      .map((m) => m[1])
      .filter((slug) => contracts.get(slug)?.approved && contracts.get(slug)?.complete);

    if (touchedApproved.length === 0) {
      const override = process.env.GOVERNANCE_OVERRIDE;
      governed.slice(0, 8).forEach((f) => log(`  governed: ${f}`));
      if (override) {
        log(`⚠ OVERRIDE ACTIVE — GOVERNANCE_OVERRIDE="${override}"`);
        log(`⚠ governed change shipped WITHOUT an approved contract by explicit override (recorded, NOT silent).`);
        die(0, `OK (overridden) — exit 0`);
      }
      log(`  ✗ no features/<slug>/lock.json with approved=true + complete (01/02/05) in this changeset`);
      die(1, `BLOCK — governed change without an approved contract (GOVERNANCE.md §1/§4). ` +
             `Lock a contract, or set GOVERNANCE_OVERRIDE="reason" (logged). exit 1`);
    }
    log(`  ↳ governed change backed by approved contract(s): ${touchedApproved.join(', ')} ✓`);

    // ── 3+4+5. UI / Mobile cycle gates (Phase 2 sub-contract 5) ──────────
    // These rules layer onto Rule 1: they only fire when there's a UI-
    // governed (Packages/*/(src|app|components|lib|screens|services)/) or
    // Mobile-governed (Packages/Mobile/src/) file in the changeset.
    // Backend-only changesets (backend/src/, backend/migrations/) are
    // unaffected — they pass through with just Rules 1+2.
    const uiChanged     = changed.filter(isUiGoverned);
    const mobileChanged = changed.filter(isMobileGoverned);
    const overrideEnv   = process.env.GOVERNANCE_OVERRIDE;
    const overrideBypass = (reason) => {
      log(`⚠ OVERRIDE ACTIVE — GOVERNANCE_OVERRIDE="${overrideEnv}"`);
      log(`⚠ ${reason} bypassed by explicit override (recorded, NOT silent).`);
      die(0, `OK (overridden) — exit 0`);
    };

    if (uiChanged.length > 0) {
      for (const slug of touchedApproved) {
        const lock = contracts.get(slug).lock;

        // Rule 3 — mockup_locked required for UI-governed changes
        if (lock.mockup_locked !== true || !lock.mockup_locked_by || !lock.mockup_locked_at) {
          log(`  ✗ Rule 3 — UI-governed path touched but contract ${slug} lacks mockup_locked`);
          log(`    touched: ${uiChanged.slice(0, 3).join(', ')}${uiChanged.length > 3 ? ' ... +' + (uiChanged.length - 3) : ''}`);
          log(`    contract: features/${slug}/lock.json`);
          log(`    state: mockup_locked=${lock.mockup_locked}, _by=${lock.mockup_locked_by ? 'set' : 'unset'}, _at=${lock.mockup_locked_at ? 'set' : 'unset'}`);
          log(`    fix: run \`pnpm preview:open ${slug}\` to review the mockups, then set`);
          log(`         mockup_locked: true + mockup_locked_by + mockup_locked_at in lock.json.`);
          log(`         Worked example: features/_demo-preview/. GOVERNANCE.md §4a.`);
          if (overrideEnv) overrideBypass(`Rule 3 (UI-governed without mockup_locked)`);
          die(1, `BLOCK — Rule 3: UI-governed change requires mockup_locked on ${slug}. ` +
                 `GOVERNANCE.md §4a. exit 1`);
        }
        const lockedByShort = String(lock.mockup_locked_by).slice(0, 40);
        log(`  ↳ ${slug} mockup_locked=true (by ${lockedByShort}${String(lock.mockup_locked_by).length > 40 ? '…' : ''}, at ${lock.mockup_locked_at}) ✓`);

        // Rule 4 — 06-diff/notes.md present + non-empty
        const notesPath = path.join(REPO_ROOT, 'features', slug, '06-diff', 'notes.md');
        const notesOk = fs.existsSync(notesPath) &&
                        fs.readFileSync(notesPath, 'utf8').trim().length > 0;
        if (!notesOk) {
          log(`  ✗ Rule 4 — UI-governed path touched but ${slug} lacks 06-diff/notes.md`);
          log(`    contract: features/${slug}/lock.json`);
          log(`    expected: features/${slug}/06-diff/notes.md (absent or empty)`);
          log(`    fix: capture after PNGs (pnpm diff:after ${slug}); author 06-diff/notes.md`);
          log(`         covering what was implemented / what matches / what diverged / what to check.`);
          log(`         Worked example: features/_demo-preview/06-diff/notes.md. GOVERNANCE.md §4b.`);
          if (overrideEnv) overrideBypass(`Rule 4 (UI-governed without 06-diff/notes.md)`);
          die(1, `BLOCK — Rule 4: UI-governed change requires 06-diff/notes.md on ${slug}. ` +
                 `GOVERNANCE.md §4b. exit 1`);
        }
        const notesSize = fs.statSync(notesPath).size;
        log(`  ↳ features/${slug}/06-diff/notes.md present (${notesSize} bytes) ✓`);
      }
    }

    if (mobileChanged.length > 0) {
      for (const slug of touchedApproved) {
        const lock = contracts.get(slug).lock;
        const rel  = lock.release || {};
        // Only enforce when THIS changeset releases the contract.
        // (WIP commits with released=false may touch Mobile freely;
        //  the maestro_green attestation is required at release-flip time.)
        if (rel.released === true && rel.maestro_green !== true) {
          log(`  ✗ Rule 5 — Mobile-governed path released without release.maestro_green on ${slug}`);
          log(`    touched: ${mobileChanged.slice(0, 3).join(', ')}${mobileChanged.length > 3 ? ' ... +' + (mobileChanged.length - 3) : ''}`);
          log(`    contract: features/${slug}/lock.json release.released=true`);
          log(`    state: release.maestro_green=${rel.maestro_green} (must be === true)`);
          log(`    fix: run \`pnpm qa:maestro\` against your device/emulator until ALL flows`);
          log(`         pass; then set "release.maestro_green": true in lock.json.`);
          log(`         GOVERNANCE.md §10.`);
          if (overrideEnv) overrideBypass(`Rule 5 (Mobile-governed release without maestro_green)`);
          die(1, `BLOCK — Rule 5: Mobile-governed release requires release.maestro_green===true on ${slug}. ` +
                 `GOVERNANCE.md §10. exit 1`);
        }
        if (rel.released === true && rel.maestro_green === true) {
          log(`  ↳ ${slug} release.maestro_green=true ✓`);
        }
      }
    }
  } else {
    log(`no governed paths changed (deploy-inert changeset) ✓`);
  }

  // 2. Release-evidence: any lock.json that flips release.released=true must
  //    carry a populated, self-consistent release/QA block (GOVERNANCE.md §5).
  const lockChanges = changed.filter((f) => /^features\/[^/]+\/lock\.json$/.test(f));
  for (const f of lockChanges) {
    let lock;
    try { lock = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')); } catch { continue; }
    const rel = lock.release || {};
    if (rel.released === true) {
      const ok = rel.released_by && rel.released_at &&
                 rel.qa_all_green !== false && (lock.result || lock.verification || rel.deploy);
      if (!ok) {
        die(1, `BLOCK — ${f} marks release.released=true but the release/QA-evidence ` +
               `block is incomplete (need released_by, released_at, qa_all_green, ` +
               `result/verification). GOVERNANCE.md §5. exit 1`);
      }
      log(`  release evidence for ${f} present + self-consistent ✓`);
    }
  }

  die(0, `OK — ${governed.length} governed change(s), all contract-backed; release evidence valid. exit 0`);
}

try { main(); }
catch (e) { die(2, `INTERNAL ERROR — ${e && e.message ? e.message : e}. (not a governance verdict) exit 2`); }
