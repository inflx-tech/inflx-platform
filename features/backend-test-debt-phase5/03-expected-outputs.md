# Expected Outputs — backend-test-debt Phase 5

> Step 3. Measured vs **236 passed / 146 failed / 382** (post-P4).
> The classified inventory + honest delta is the output; "it
> runs" is not.

## Per-step expected outputs
| Step | Observable output | Verified by |
|---|---|---|
| 1 Fresh run | `db-jest.log`+`db-lane.json`; true pass/fail recorded | `pnpm qa:db` |
| 2 Inventory | Every failing test (suite › test + signature); count == failed | jest summary cross-check |
| 3 Classify | Each failure 1/2/3/4 with controller `file:line` justification | inventory table |
| 4 Align | (1)(2)(4) fixes traceable to the contract line | `git diff backend/tests/**` |
| 5 Carve | One `features/backend-defect-<slug>/` per class-3; test RED | new carve folders |
| 6 Re-measure | Honest delta vs 236/146 + inventory in `lock.json` | `pnpm qa:db` re-run |
| 7 Regression | main `pnpm qa` 66 GREEN / C1 / gate 0; gov-check OK | `pnpm qa`; `qa/reports/latest.md` |

## Hard expectations (GOVERNANCE.md §8)
- No `.skip`/deletion/assertion-weakening/fabricated-data/
  force-pass anywhere. Negative-assertion tests left intact.
- No test catching a genuine backend bug edited to pass — carved
  RED instead.
- Delta reported truthfully even if small. "N classified, M
  honestly fixed, K carved, failed 146→X" — X is whatever it
  honestly is. A masked improvement is a contract failure.
- migrations stay 53/53 0-error; main lane unchanged
  (Phase 5 = test-infra + carves only; deploy-inert).

## Evidence
- `qa/artifacts/db-jest.log` (fresh pre/post), `db-lane.json`
  delta, full classified inventory + delta in `lock.json` +
  `04-preview/README.md`, `qa/reports/latest.md` (main lane
  unchanged), gov-check pass on push.
