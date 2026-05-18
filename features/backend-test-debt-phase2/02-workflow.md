# Workflow Definition — backend-test-debt Phase 2

> Step 3. Verified via `pnpm qa:db` (DB lane). Evidence-driven.

## Baseline (post Phase 1)
`db-lane.json`: substrate OK, migrations 53/53, jest
**138 passed / 244 failed / 382 total**, laneState FAIL.

## Workflow
1. **Instrument:** `qa-db.mjs` writes the full backend jest
   stdout+stderr to `qa/artifacts/db-jest.log` (in addition to the
   parsed summary). Verify the file is produced and complete.
2. **Run + capture:** `pnpm qa:db` once to produce a fresh
   `db-jest.log` at the 138/244 baseline.
3. **Classify:** from the log, group the 244 by (suite, root-cause
   class). Record the class breakdown in this contract's lock.
4. **Fix the top cluster:** the single highest-count, lowest-risk
   root cause (hypothesis: a second stale shared factory such as
   `registerInfluencer`, or a shared seed helper) — smallest
   contract-aligning change. Exact target chosen from the log.
5. **Re-measure:** `pnpm qa:db`; read new `db-lane.json`.

## Success definition
SUCCESSFUL iff: (a) `db-jest.log` is produced and used as the
triage source (no guessing), AND (b) a documented class breakdown
of the 244 is recorded, AND (c) the chosen batch is a real
contract alignment that produces a **measured** pass increase vs
138, AND (d) the new numbers + residual are recorded honestly for
Phase 3. laneState=PASS is NOT required.

## Failure / edge
- If a failure cluster is a genuine BACKEND bug (not stale test) →
  do NOT patch the test to hide it; surface it as its own
  finding/contract. Phase 2 only aligns stale tests to correct
  behaviour.
- If the top cluster fix yields little → report honestly, the
  cascade hypothesis was wrong, re-triage; never pad numbers.
