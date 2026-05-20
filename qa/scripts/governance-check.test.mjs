#!/usr/bin/env node
'use strict';

/**
 * governance-check.test.mjs — in-process scenario runner for the
 * five gov-check rules. Each scenario:
 *   1. Builds a tiny temp git repo with a copy of governance-check.mjs
 *      under qa/scripts/.
 *   2. Creates synthetic features/<slug>/lock.json + required files
 *      (and optionally 06-diff/notes.md).
 *   3. Stages a synthetic source-code change to trigger a rule.
 *   4. Spawns gov-check as a child process and asserts exit code +
 *      stdout contents.
 *   5. Cleans up the temp dir.
 *
 * Zero deps (node builtins + git CLI). Exit 0 iff all scenarios pass.
 *
 * Contract: features/enforce-cycle-gates/ (Phase 2 sub-contract 5).
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VALIDATOR = path.join(REPO_ROOT, 'qa', 'scripts', 'governance-check.mjs');
const TAG = '[gov-check-test]';

let passed = 0, failed = 0;
const failures = [];

function setupTmpRepo() {
  const tmpRoot = path.join(
    os.tmpdir(),
    'gov-check-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  );
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'qa', 'scripts'), { recursive: true });
  fs.copyFileSync(VALIDATOR, path.join(tmpRoot, 'qa', 'scripts', 'governance-check.mjs'));
  fs.mkdirSync(path.join(tmpRoot, 'features'), { recursive: true });

  // git init + baseline commit so HEAD~1 resolves cleanly.
  execSync('git init -q', { cwd: tmpRoot });
  execSync('git config user.email test@inflx.test', { cwd: tmpRoot });
  execSync('git config user.name test', { cwd: tmpRoot });
  execSync('git config commit.gpgsign false', { cwd: tmpRoot });
  fs.writeFileSync(path.join(tmpRoot, '.gitkeep'), '');
  execSync('git add -A', { cwd: tmpRoot });
  execSync('git commit -q -m baseline', { cwd: tmpRoot });
  return tmpRoot;
}

function setupContract(tmpRoot, slug, lockJson, files = {}) {
  const slugDir = path.join(tmpRoot, 'features', slug);
  fs.mkdirSync(slugDir, { recursive: true });
  fs.writeFileSync(
    path.join(slugDir, 'lock.json'),
    JSON.stringify({ feature: slug, ...lockJson }, null, 2)
  );
  // Required for "complete" per the validator (01-spec, 02-workflow, 05-impact).
  for (const n of ['01-spec.md', '02-workflow.md', '05-impact.md']) {
    fs.writeFileSync(path.join(slugDir, n), `# ${n}\nplaceholder\n`);
  }
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(slugDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
}

function addChange(tmpRoot, relPath, content) {
  const fullPath = path.join(tmpRoot, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function commitAll(tmpRoot) {
  execSync('git add -A', { cwd: tmpRoot });
  execSync('git commit -q -m scenario', { cwd: tmpRoot });
}

function runValidator(tmpRoot, extraEnv = {}) {
  // Strip ambient GOVERNANCE_OVERRIDE / GOV_BASE so the agent's env
  // doesn't bleed into scenarios that need the defaults.
  const env = { ...process.env };
  delete env.GOVERNANCE_OVERRIDE;
  delete env.GOV_BASE;
  delete env.GITHUB_BASE_REF;
  const r = spawnSync('node', ['qa/scripts/governance-check.mjs'], {
    cwd: tmpRoot,
    encoding: 'utf8',
    env: { ...env, ...extraEnv },
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function cleanup(tmpRoot) {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
}

function assertExit(r, expected) {
  if (r.code !== expected) {
    throw new Error(
      `exit expected ${expected}, got ${r.code}\n` +
      `  stdout: ${r.stdout.slice(0, 800)}\n` +
      `  stderr: ${r.stderr.slice(0, 800)}`
    );
  }
}

function assertContains(r, substring) {
  const combined = r.stdout + r.stderr;
  if (!combined.includes(substring)) {
    throw new Error(
      `expected output to contain "${substring}"\n` +
      `  got: ${combined.slice(0, 800)}`
    );
  }
}

function scenario(name, fn) {
  const tmpRoot = setupTmpRepo();
  try {
    fn(tmpRoot);
    console.log(`${TAG} ✓ ${name}`);
    passed += 1;
  } catch (e) {
    console.log(`${TAG} ✗ ${name}`);
    console.log(`${TAG}   reason: ${e.message.replace(/\n/g, '\n' + TAG + '   ')}`);
    failed += 1;
    failures.push(name);
  } finally {
    cleanup(tmpRoot);
  }
}

// ── Scenarios ───────────────────────────────────────────────────────────

scenario('1. deploy-inert changeset (only LOCAL.md modified) → OK', (tmp) => {
  addChange(tmp, 'LOCAL.md', '# updated\n');
  commitAll(tmp);
  const r = runValidator(tmp);
  assertExit(r, 0);
  assertContains(r, 'no governed paths changed');
});

scenario('2. backend-only governed + approved contract → OK (Rules 3/4/5 dont fire)', (tmp) => {
  setupContract(tmp, 'test-backend', {
    approved: true, status: 'locked',
    release: { released: false }
  });
  addChange(tmp, 'backend/src/foo.js', 'module.exports = {};\n');
  commitAll(tmp);
  const r = runValidator(tmp);
  assertExit(r, 0);
  assertContains(r, 'governed change backed by approved contract');
});

scenario('3. UI-governed + mockup_locked + notes.md → OK', (tmp) => {
  setupContract(tmp, 'test-ui-ok', {
    approved: true, status: 'locked',
    mockup_locked: true, mockup_locked_by: 'agent', mockup_locked_at: '2026-05-20',
    release: { released: false }
  }, {
    '06-diff/notes.md': '# notes\nwhat shipped: X.\n',
  });
  addChange(tmp, 'Packages/brand-web/app/foo/page.js', 'export default function() {}\n');
  commitAll(tmp);
  const r = runValidator(tmp);
  assertExit(r, 0);
  assertContains(r, 'mockup_locked=true');
  assertContains(r, '06-diff/notes.md present');
});

scenario('4. UI-governed + mockup_locked=false → FAIL Rule 3', (tmp) => {
  setupContract(tmp, 'test-ui-no-lock', {
    approved: true, status: 'locked',
    mockup_locked: false,
    release: { released: false }
  }, {
    '06-diff/notes.md': '# notes\n',
  });
  addChange(tmp, 'Packages/brand-web/app/foo/page.js', 'export default function() {}\n');
  commitAll(tmp);
  const r = runValidator(tmp);
  assertExit(r, 1);
  assertContains(r, 'Rule 3');
  assertContains(r, 'mockup_locked');
});

scenario('5. UI-governed + locked, missing notes.md → FAIL Rule 4', (tmp) => {
  setupContract(tmp, 'test-ui-no-notes', {
    approved: true, status: 'locked',
    mockup_locked: true, mockup_locked_by: 'agent', mockup_locked_at: '2026-05-20',
    release: { released: false }
  });
  addChange(tmp, 'Packages/Mobile/src/screens/Feed.js', 'export default function Feed() {}\n');
  commitAll(tmp);
  const r = runValidator(tmp);
  assertExit(r, 1);
  assertContains(r, 'Rule 4');
  assertContains(r, '06-diff/notes.md');
});

scenario('6. MOBILE + released=true + no maestro_green → FAIL Rule 5', (tmp) => {
  setupContract(tmp, 'test-mobile', {
    approved: true, status: 'released',
    mockup_locked: true, mockup_locked_by: 'agent', mockup_locked_at: '2026-05-20',
    result: 'shipped',
    release: {
      released: true,
      released_by: 'agent',
      released_at: '2026-05-20',
      qa_all_green: true,
      // maestro_green NOT set — must FAIL
    }
  }, {
    '06-diff/notes.md': '# notes\n',
  });
  addChange(tmp, 'Packages/Mobile/src/config/api.js', '/* changed */\n');
  commitAll(tmp);
  const r = runValidator(tmp);
  assertExit(r, 1);
  assertContains(r, 'Rule 5');
  assertContains(r, 'maestro_green');
});

scenario('7. GOVERNANCE_OVERRIDE bypasses Rule 3 → OK (loud)', (tmp) => {
  setupContract(tmp, 'test-override', {
    approved: true, status: 'locked',
    mockup_locked: false,
    release: { released: false }
  });
  addChange(tmp, 'Packages/brand-web/app/foo/page.js', 'export default function() {}\n');
  commitAll(tmp);
  const r = runValidator(tmp, { GOVERNANCE_OVERRIDE: 'testing-the-bypass' });
  assertExit(r, 0);
  assertContains(r, 'OVERRIDE ACTIVE');
});

// ── Summary ─────────────────────────────────────────────────────────────
console.log('');
const total = passed + failed;
if (failed === 0) {
  console.log(`${TAG} === ${passed}/${total} scenarios PASSED ===`);
  process.exit(0);
} else {
  console.log(`${TAG} === ${passed}/${total} passed; ${failed} FAILED ===`);
  for (const n of failures) console.log(`${TAG}   - ${n}`);
  process.exit(1);
}
