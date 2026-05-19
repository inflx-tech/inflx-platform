# Expected Outputs — backend-test-debt Phase 6

> Step 3. Measured vs **259 passed / 123 failed / 382** (post-P5,
> deterministic instrument → noise-free delta).

## Per-step expected outputs
| Step | Observable output | Verified by |
|---|---|---|
| 1 Inventory | Every failing test (suite › test + signature); count == failed | jest summary cross-check |
| 2 Classify | Each failure 1/2/3/4 with controller `file:line` justification | inventory table |
| 3 Align | (1)(2)(4) fixes traceable to the contract line | `git diff backend/tests/**` |
| 4 Carve | One `features/backend-defect-<slug>/` per class-3; test RED | new carve folders |
| 5 Re-measure | Honest delta vs 259/123 + inventory in `lock.json` | fresh `pnpm qa:db` |
| 6 Regression | main `pnpm qa` 66 GREEN / C1 / gate 0; gov-check OK | `pnpm qa`; `qa/reports/latest.md` |

## Hard expectations (GOVERNANCE.md §8)
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Negative-assertion tests left intact.
- No test catching a genuine backend bug edited to pass — carved
  RED instead.
- Delta reported truthfully even if small. "N classified, M
  honestly fixed, K carved, failed 123→X" — X is whatever it
  honestly is. Determinism means X is exact (no ± noise); a
  masked improvement is a contract failure.
- migrations stay 53/53 0-error; main lane unchanged
  (Phase 6 = test-infra + carves only; deploy-inert).

## Evidence
- `qa/artifacts/_p5_remeasure_qadb.log` (post-P5 inventory) +
  fresh `pnpm qa:db` (post-P6), full classified inventory +
  delta in `lock.json` + `04-preview/README.md`,
  `qa/reports/latest.md` (main lane), gov-check pass on push.
