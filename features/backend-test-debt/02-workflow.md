# Workflow Definition — backend-test-debt Phase 1

> Step 3. Verified via the B2b DB lane (`pnpm qa:db`).

## Actor
QA operator running `pnpm qa:db` (Docker up).

## Baseline (B2b run 2026-05-18)
`db-lane.json`: substrate OK, migrations 53/53, jest
**101 passed / 281 failed / 382 total**, laneState FAIL.

## Workflow
1. Audit `tests/helpers/factories.js` against the live backend
   contracts it calls: `/auth/verify-otp`, `/brands/register`,
   `/influencers/register`. Pin each endpoint's currently-required
   fields by reading the controllers (Step 7).
2. Fix the factories to send the required fields — confirmed:
   `registerBrand` must include `name`; add `city`/`state`/
   `address_line` only if the controller requires them (verified at
   Step 7, not guessed).
3. Re-run `pnpm qa:db`.
4. Read the new `db-lane.json`: record new passed/failed/total.

## Success definition
SUCCESSFUL iff: (a) factories.js matches the real contracts (no
fabricated fields, only what the controllers require), AND (b) the
DB lane shows a **material, measured** increase in passed tests vs
the 101 baseline, AND (c) the new numbers are recorded truthfully
in the contract + `backend-test-debt` ledger. Phase 1 does NOT
require laneState=PASS (debt is phased); it requires honest,
measurable progress with no suppression.

## Failure / edge
- If the factory fix does NOT move the numbers materially → the
  cascade hypothesis was wrong; report that honestly and re-triage
  (the real failures are elsewhere) — do not pad or force-green.
- Any remaining failures after Phase 1 stay tracked in the ledger
  with the new baseline for Phase 2.
