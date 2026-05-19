# Impact Analysis — qa-db-truncate-flake (carved finding)

## Deploy posture
- **This carve: DEPLOY-INERT.** Adds only this
  `features/qa-db-truncate-flake/` finding. No code/test/config
  change; the qa:db lane is left honestly ±1, not masked. No
  Render/Vercel.
- **Future fix: DEPLOY-INERT** too (test-infra only:
  `tests/helpers/db.js` reset strategy + per-test request
  hygiene). Unless investigation proves a genuine production
  connection-leak path → then a separate production-impacting
  carve.

## Affected (future fix, not this carve)
- `backend/tests/helpers/db.js` (`truncateAll` strategy) and/or
  per-test request hygiene in the suites whose `beforeEach`
  intermittently times out (`influencer.test.js`,
  `negotiations.test.js`, others by timing).
- Verifier: ≥3 identical consecutive `pnpm qa:db` runs.

## Regression surface (future fix)
- Changing the inter-test reset must keep tests isolated (each
  test still starts clean) — a rollback/scoped reset must be
  proven equivalent to the current TRUNCATE for isolation.

## Risk notes
- The honest ±1 noise floor is now **characterized and bounded**
  (one timeout-flake/run on the truncate hook). Phase-5 deltas
  move dozens of tests, so a known ±1 floor does not make them
  meaningless — but strict determinism is not yet met. The
  decision to (a) fix this before resuming Phase 5 vs
  (b) resume Phase 5 citing a stated ±1 floor is a governance
  judgement surfaced to the founder.
- Source: `features/qa-db-determinism` Step 7, 3-run determinism
  proof 2026-05-19 (real qa:db logs).
