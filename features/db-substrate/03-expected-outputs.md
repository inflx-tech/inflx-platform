# Expected Outputs — DB substrate (B2b)

> Step 3 (cont.). DB lane is reported separately. Defined BEFORE code.

## Expected outputs
| Phase | Observable | Verified by |
|---|---|---|
| db-up | container reachable; `TEST_DATABASE_URL` set | qa:db logs "DB ready @ <port>" |
| migrate-all | all 53 migrations applied, 0 SQL errors; count printed | setup.js logs "✓ applied 53/53 migrations" |
| jest | backend suite runs to completion; real pass/fail captured | jest exit + summary on the DB lane |
| db-down | container removed even on failure | `docker ps` shows no `inflx-qa-*` |
| report | distinct "## DB lane" section: status, jest pass/fail counts, migrations-applied | qa-report.mjs renders it; main verdict unchanged |

## Hard invariants
- DB-lane status is NEVER merged into the main `pnpm qa` GREEN
  (C1 verdict computed only from the no-DB suite).
- A non-running Docker / migration error / unrun lane → DB lane
  shows FAIL or "NOT EXERCISED" — never blank, never implied green.
- "Migrations apply 0-error" is asserted independently of legacy
  jest pass rate (the substrate proof).

## Findings handling
- If migrations 002→054 surface an error → record exact file +
  error; the lane FAILS; a follow-up tracked contract (B2b-fix)
  is opened. Not suppressed, not worked-around.
- If legacy jest tests fail against the correct full schema →
  reported with counts on the DB lane; cataloged as tracked
  findings for later contracts. Not a B2b substrate failure (the
  substrate succeeded in *revealing* them truthfully).

## Implemented by (after lock + Docker verified up)
- `qa/scripts/db-up.mjs`, `qa/scripts/db-down.mjs`,
  `qa/scripts/qa-db.mjs` (lane orchestrator)
- `backend/tests/setup.js` (apply all migrations, sorted)
- `qa-report.mjs` DB-lane section (additive; main verdict logic
  from C1 untouched)
- root `qa:db` script
Result captured in `qa/reports/latest.md` DB-lane section.
