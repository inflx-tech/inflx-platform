# Expected Outputs — backend-defect-city-column fix

> Step 3 (cont.). Measured vs the post-P3 baseline 188/194/382.

| Item | Before | Expected after |
|---|---|---|
| `column "city" does not exist` 500 on /v1/campaigns/* | ×3 | **0** |
| carved campaign test(s) | RED | GREEN (by backend fix, not test edit) |
| backend jest passed | 188/382 | **higher** (≥188 + the carved tests; exact recorded) |
| migrations | 53/53 0-error | unchanged |
| main `pnpm qa` (66) + C1 | green | unchanged green |

## Hard expectations
- Root cause identified from the REAL qa:db Postgres error
  (statement + relation), file:line pinned — no guessing.
- Minimal SQL change only; influencer-matching behaviour otherwise
  identical (a column-resolution fix, not a feature change).
- The carved test(s) pass because the BACKEND is now correct — the
  test is NOT modified to pass.
- No `.skip`/deletion/assertion-weakening anywhere.

## Evidence
- `qa/artifacts/db-jest.log` pre-fix (the exact pg error) and
  post-fix (no `city` 500; carved tests green)
- `qa/artifacts/db-lane.json` delta
- this lock: pinned file:line, the SQL diff summary, baseline→result

## Implemented by (after lock)
- minimal SQL fix in the pinned backend controller (likely
  `campaign.controller.js`)
- re-run `pnpm qa:db`; record result; close the defect finding
