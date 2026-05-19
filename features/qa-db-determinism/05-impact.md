# Impact Analysis — qa:db determinism

## Deploy posture — DEPLOY-INERT
- Changes: `backend/jest.config.js`, a new `backend/tests/`
  teardown setup file, `backend/package.json` `test` script
  (drop `--forceExit`), possibly `backend/tests/helpers/db.js`
  (export-only). All **test-infra** — not in the running-server
  import graph. No migration/web/mobile/OTA/`src` runtime
  change → `git push` triggers no Render/Vercel deploy.
- **Conditional carve:** if `--detectOpenHandles` proves a leak
  originating in `src/**` production code (a real handle a
  production process also leaks), that is a genuine
  production-impacting defect → **carved** as its own contract,
  not patched here.

## Affected files
- `backend/jest.config.js` — add `setupFilesAfterEach` (or
  `setupFiles`) pointing at the new teardown file.
- `backend/tests/<teardown>.js` (new) — global `afterAll`
  closing `helpers/db.js closePool()` + `require('../src/config/
  db').pool.end()` (+ any evidenced handle).
- `backend/package.json` — `test`: remove `--forceExit` (keep
  `--runInBand` for DB-race safety).
- `backend/tests/helpers/db.js` — only if an export tweak is
  needed; no logic change.
- **Read-only (must NOT change):** `src/**`, migrations,
  `qa/scripts/*`, C1 spec, `playwright.config.ts`,
  `governance-check.mjs`.

## Affected workflows (regression surface)
- The qa:db lane itself is the target — expected to become
  faster + deterministic; the genuine RED residual is unchanged
  (only timeout-flake noise removed).
- Main `pnpm qa` (66 Playwright + C1): independent of backend
  jest; must stay identical. Re-run at Step 7 to prove.
- `globalSetup`/`globalTeardown` (`tests/setup.js`/`teardown.js`)
  schema lifecycle: unchanged. The new per-worker afterAll is
  additive and complementary (closes worker-scoped pools the
  global teardown structurally cannot).

## Risk notes
1. **Hidden second leak** — closing the 2 pools may reveal
   another handle (timer/listener). Mitigation: evidence-first
   `--detectOpenHandles`; iterate until genuinely clean; never
   re-mask with `--forceExit`/timeout bump.
2. **Determinism not from handles alone** — if counts still
   swing after clean exit, a second cause exists (test ordering,
   shared DB state across files under `--runInBand`, or
   date-relative logic). Mitigation: the ≥3-run determinism gate
   will catch it; inventory + classify the real cause; do not
   declare done on one green run.
3. **`--forceExit` removal regressing CI** — only removed after
   a proven clean self-exit; if Jest hangs, that is a real
   remaining leak to fix, not a reason to restore the mask.
4. Reproduced on the real 53-migration Docker PG (same env the
   nondeterminism was observed in) — deterministic verification.

## Dependency
Blocks `features/backend-test-debt-phase5` (PAUSED). Phase 5
resumes against the new honest, stable baseline produced here.
