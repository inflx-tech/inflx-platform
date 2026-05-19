# Expected Outputs — backend-test-debt Phase 7

> Step 3. Measured vs **300 passed / 82 failed / 382** (post-P6,
> deterministic instrument → noise-free delta).

## Per-step expected outputs
| Step | Observable output | Verified by |
|---|---|---|
| 1 Inventory | Every failing test (suite › test + signature); count == 82 | jest summary cross-check |
| 2 Classify | Each failure 1/2/3/4 with controller `file:line` justification | inventory table + instrumented chain |
| 3 Align | The 3 levers traceable to the cited contract line | `git diff backend/tests/**` |
| 4 Carve | One `features/backend-defect-<slug>/` per NEW class-3; test RED | new carve folders (expect none) |
| 5 Re-measure | Honest delta vs 300/82 + inventory in `lock.json` | fresh `pnpm qa:db` |
| 6 Regression | main `pnpm qa` 66 GREEN / C1 / gate 0; gov-check OK | `pnpm qa`; `qa/reports/latest.md` |

## Hard expectations (GOVERNANCE.md §8)
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Negative-assertion tests left intact.
- No test catching a genuine backend bug edited to pass — carved
  RED instead.
- Delta reported truthfully even if small. "82 classified, M
  honestly fixed, K carved, failed 82→X" — X is whatever it
  honestly is. Determinism means X is exact (no ± noise); a
  masked improvement is a contract failure.
- The independent non-cascade clusters (listing-schema ×10,
  register-422 ×3, money-convention ×4, engagement ×1) are
  CLASSIFIED in the inventory but deliberately NOT fixed this
  batch (Phase-8 rung) — recorded, not hidden.
- migrations stay 53/53 0-error; main lane unchanged
  (Phase 7 = test-infra only; deploy-inert).

## Evidence
- `qa/artifacts/_p6b_remeasure_qadb.log` (post-P6 inventory) +
  `qa/artifacts/_p7_diag.log` (the reverted instrumented chain)
  + fresh `pnpm qa:db` (post-P7), full classified inventory +
  delta in `lock.json` + `04-preview/README.md`,
  `qa/reports/latest.md` (main lane), gov-check pass on push.
