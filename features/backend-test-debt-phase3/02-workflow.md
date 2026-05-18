# Workflow Definition — backend-test-debt Phase 3

> Step 3. Verified via `pnpm qa:db`. Evidence-driven; the
> defect/test split is the core discipline of this phase.

## Baseline (post P2)
`db-lane.json`: substrate OK, migrations 53/53, jest
**151 passed / 231 failed / 382 total**, laneState FAIL.

## Workflow
1. **Run + capture:** `pnpm qa:db` → fresh `db-jest.log` at 151/231.
2. **Sub-classify the status-drift cluster** from the log:
   - (i) stale-create-payload: `201→422` where the test sends an
     outdated body vs the current controller (read the controller
     to confirm the now-required fields — no guessing).
   - (ii) **genuine backend defect:** `200→500`, or a correct
     request getting a wrong status — the *backend* is wrong, not
     the test.
   - (iii) authz/contract drift: `404→403`, `401→500`, etc.
3. **Fix the top (i) batch:** align those create-payloads to the
   real contracts (smallest change, largest cluster).
4. **(ii) handling:** for each genuine-defect candidate, open a
   distinct finding stub under `features/` and LEAVE THE TEST
   FAILING (it correctly catches a real bug). Do not edit it.
5. **Re-measure:** `pnpm qa:db`; record honest delta + residual +
   the count of (ii) findings carved out.

## Success definition
SUCCESSFUL iff: the cluster is sub-classified from evidence; the
(i) batch is a real contract alignment producing a **measured**
pass increase vs 151; every (ii) genuine defect is carved out as
its own finding (NOT masked); numbers + residual + defect-count
recorded honestly. laneState=PASS NOT required.

## Failure / edge
- A test that fails because the BACKEND is wrong stays failing and
  becomes a backend-defect contract — paying down test debt must
  never hide a product bug. This is the explicit point of Phase 3.
- If (i) fixes move little → report honestly; re-triage.
