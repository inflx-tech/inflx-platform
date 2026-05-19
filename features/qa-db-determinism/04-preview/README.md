# Preview (Step 4) — qa:db determinism

No UI. Test-instrument stabilization. Reviewer note + Step-7
evidence here.

## Reviewer note (Step-5 lock)
- **DEPLOY-INERT.** Touches `backend/jest.config.js`, a new
  `backend/tests/` teardown setup file, `backend/package.json`
  test script, possibly `backend/tests/helpers/db.js` (export).
  No `src/**` runtime change → no Render/Vercel. (If a genuine
  runtime leak is evidenced, it is CARVED as its own
  production-impacting contract, not fixed here.)
- The fix is **real teardown**, not masking: close the two
  leaked `pg` pools per worker so Jest exits cleanly and
  `--forceExit` can be **removed**.
- Forbidden (founder): no fake stabilization, no `testTimeout`
  inflation, no skip/delete, no force-green. Determinism proven
  by ≥3 identical consecutive runs — not asserted.
- Genuine residual failures stay RED and unchanged; only the
  timeout-flake *noise* disappears (it was never real failures).

## Root cause (verify-twice, real code)
```
tests/helpers/db.js   : new Pool(max5)  — closePool() NEVER called
                        (0/28 test files have afterAll)
src/config/db.js      : new Pool(max20, idle 30s) on require(app)
                        — never .end() in tests
jest.config.js        : only globalSetup/globalTeardown (separate
                        process — cannot close worker pools)
package.json          : jest --runInBand --forceExit  ← MASK
→ workers exit with 2 live pools → forceExit needed → under load
  hooks exceed 30s testTimeout → ±3–8 flaky "failures" (noise)
```

## Step 7 — RESULTS (2026-05-19) — PARTIAL (honest)
```
detectOpenHandles (pre) : 2 TCPWRAP — tests/helpers/db.js:20 pool
                          + app pool via supertest/src/config/db.js
teardown added          : backend/tests/jest.afterEnv.js
                          (per-worker afterAll: closePool() +
                          app pool.end(); guarded/idempotent)
                          + jest.config.js setupFilesAfterEnv
forceExit removed       : YES — clean self-exit PROVEN first
                          (JEST_EXIT=0, no hang)
detectOpenHandles (post): CLEAN — zero open handles
determinism (3 runs)    : failed = 147 / 146 / 147  → NOT identical
                          variance ±3-8 (pre 146↔149) → ±1; faster
honest baseline         : ±1 nondeterministic (≈146-147/382);
                          NOT faked stable
residual                : CARVED features/qa-db-truncate-flake
                          (truncateAll() beforeEach intermittently
                          >30s; lock/connection contention) — NOT
                          masked (no timeout-inflate/skip/forceExit)
main pnpm qa            : <pending regression confirmation>
deploy posture          : DEPLOY-INERT (test-infra only)
```
**Disposition:** dominant leaked-handle nondeterminism + the
`--forceExit` mask genuinely eliminated and proven; a smaller
fully-characterized ±1 residual carved as its own finding.
Trust materially improved; strict determinism is a follow-on.
Founder fork surfaced: fix qa-db-truncate-flake before resuming
Phase 5, vs resume Phase 5 with a known bounded ±1 floor.
