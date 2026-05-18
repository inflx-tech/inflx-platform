# Expected Outputs — backend-test-debt Phase 1

> Step 3 (cont.). Measured against the B2b baseline. Defined BEFORE code.

## Baseline → expected
| Metric | Baseline (B2b) | Phase 1 expected |
|---|---|---|
| backend jest passed | 101 / 382 | **materially higher** (measured; exact number recorded post-run, not pre-promised) |
| migrations applied | 53/53 0-error | unchanged (53/53) |
| substrate | OK | OK |
| DB laneState | FAIL | FAIL or PASS — recorded honestly (PASS only if 0 failed) |

## Hard expectations
- `factories.js` sends ONLY fields the controllers actually require
  (verified by reading them at Step 7) — no fabricated/guessed
  fields to "make tests pass".
- New `db-lane.json` numbers written truthfully; the
  `backend-test-debt` ledger updated with the new baseline and the
  residual count for Phase 2.
- No spec/test deletion or `.skip` to inflate the pass rate. A test
  that fails for a real reason stays failing and tracked.

## Evidence
- `qa/artifacts/db-lane.json` (post-fix): passed/failed/total.
- The qa-report "DB lane" section reflects it.
- This contract's lock `qa_run` records baseline→result delta.

## Implemented by (after lock)
- `backend/tests/helpers/factories.js` (align to live contracts).
- Re-run `pnpm qa:db`; capture + record the measured delta.
