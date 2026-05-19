# Feature Spec — qa:db determinism (instrument stabilization)

> Step 1. Implementation GATED on `lock.json.approved = true`.
> Founder directive 2026-05-19: make the qa:db measuring
> instrument trustworthy BEFORE further residual paydown.
> Blocks `features/backend-test-debt-phase5` (paused).

## Problem / goal
The qa:db backend-jest lane is **nondeterministic**: run-to-run
the failed count swings (146 ↔ 149) with **zero code changes**.
Verify-twice root cause (real code, not hypothesis):

- `tests/helpers/db.js` opens a `pg` Pool (max 5); exports
  `closePool()` but it is **never called** — `grep` shows 0 of
  28 test files have any `afterAll`; no per-worker teardown.
- `src/config/db.js` opens the app `pg` Pool (max 20,
  `idleTimeoutMillis: 30000`) on `require('../src/app')` (nearly
  every test). **Never `.end()`-ed** in tests.
- `jest.config.js` defines only `globalSetup`/`globalTeardown`,
  which run in a **separate process** from the test workers and
  therefore **cannot** close pools created inside workers.
- Net: each worker exits with 2 live pools (sockets + the 30s
  idle timer). Jest would hang, so `package.json` uses
  `jest --runInBand --forceExit` — **`--forceExit` masks the
  leak**. Under machine load the leaked handles + GC pressure
  make hooks (e.g. `truncateAll`) intermittently exceed the
  30s `testTimeout` → flaky timeout "failures" (≈3–8/run) that
  are noise, not real defects.

Goal: eliminate the actual async-handle/resource leaks so the
suite exits cleanly **without `--forceExit`**, runs in
predictable time, and produces a **deterministic** failed count
run-to-run — so Phase-5+ deltas are meaningful and autonomous
governance stays reliable.

## Scope (instrument stabilization)
1. **Evidence-first**: run `jest --detectOpenHandles` on a
   representative slice to capture the ACTUAL open-handle stacks
   (prove the two pools; surface any others — timers, listeners,
   sockets, unresolved promises). No fix before evidence.
2. **Honest teardown**: add a Jest per-worker teardown
   (`setupFilesAfterEach`/`setupFiles` registering a global
   `afterAll`) that closes BOTH pools — `tests/helpers/db.js`
   `closePool()` and the already-exported `src/config/db.js`
   `pool.end()` — plus any other leaked handle the evidence
   shows. Test-infra only; `src/` runtime untouched (the app
   pool is already exported; teardown just calls `.end()`).
3. **Remove the mask**: drop `--forceExit` from the test script
   **only after** handles are genuinely closed and a clean exit
   is proven. If anything still leaks, find it via
   `--detectOpenHandles` and close it — never re-add `--forceExit`
   or inflate `testTimeout` as a substitute.
4. **Re-establish an honest baseline**: run `pnpm qa:db`
   **multiple times** (≥3) and show the failed count is now
   STABLE (deterministic) — record the true number.
5. Re-run main `pnpm qa` (66/C1/gate-0) — confirm zero
   regression. Classify deploy-inert vs production-impacting.

## Out of scope / forbidden (founder requirements)
- **No fake stabilization. No timeout inflation as masking. No
  `.skip`/delete. No force-green.** A "stable" number achieved
  by hiding flakes is an explicit FAILURE.
- Not the residual paydown itself (that is Phase 5, resumed
  after this lands on the new honest baseline).
- No change to `src/**` runtime behaviour. If the evidence shows
  a genuine RUNTIME leak (e.g. a real `setInterval`/client a
  production path leaves open), that is **carved** as its own
  production-impacting defect, not fixed here.

## Surfaces touched
- `backend/jest.config.js`, a new `backend/tests/` teardown
  setup file, `backend/package.json` test script, possibly
  `backend/tests/helpers/db.js` (export only). **Deploy-inert**
  (test-infra; not in the running-server import graph; no
  migration/web/mobile/OTA/runtime change).

## Non-functional
- Success = real leaks eliminated (clean Jest exit WITHOUT
  `--forceExit`), `--detectOpenHandles` clean, qa:db failed
  count deterministic across ≥3 runs, honest new baseline
  recorded, main `pnpm qa` unchanged. Trust restored, not faked.
