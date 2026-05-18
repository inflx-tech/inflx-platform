# Expected Outputs — backend-test-debt Phase 2

> Step 3 (cont.). Measured vs the post-Phase-1 baseline.

| Metric | Post-Phase-1 | Phase 2 expected |
|---|---|---|
| `qa/artifacts/db-jest.log` | absent | present, complete, used for triage |
| 244-failure class breakdown | none | documented in lock (suite × cause) |
| backend jest passed | 138 / 382 | **materially higher** (measured; exact recorded post-run) |
| migrations | 53/53 0-error | unchanged |
| DB laneState | FAIL | FAIL or PASS — recorded honestly (PASS only if 0 failed) |

## Hard expectations
- Triage cites the log (no guessed causes).
- Batch fix = real contract alignment ONLY; no `.skip`, no test
  deletion, no fabricated data, no force-green.
- Genuine backend bugs (if any) surfaced as separate findings, not
  hidden by test edits.
- New baseline + residual class list written to the ledger for
  Phase 3.

## Evidence
- `qa/artifacts/db-jest.log` (triage source)
- `qa/artifacts/db-lane.json` post-fix (passed/failed/total)
- this contract's lock: class breakdown + baseline→result delta

## Implemented by (after lock)
- `qa/scripts/qa-db.mjs` (persist full jest log)
- the triage-identified next batch under `backend/tests/**`
- re-run `pnpm qa:db`; record measured delta + residual
