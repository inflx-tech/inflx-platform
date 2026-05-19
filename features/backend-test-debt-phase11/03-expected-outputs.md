# Expected Outputs — backend-test-debt Phase 11

> Step 3. Measured vs **359 passed / 23 failed / 382** (post-P10,
> deterministic instrument → noise-free delta).

## Per-step expected outputs
| Step | Observable output | Verified by |
|---|---|---|
| 1 Inventory | The 10 campaigns-area failing tests (suite › test + signature) | jest summary cross-check |
| 2 Classify | Each 1/2/3/4 with controller `file:line` | campaign.controller.js + campaign.routes.js reads |
| 3 Align | Fixture/assertion alignments traceable to the cited contract | `git diff` of the 2 test files |
| 4 Carve | One `features/backend-defect-<slug>/` per genuine class-3 | none expected |
| 5 Re-measure | Honest delta vs 359/23 + inventory in `lock.json` | fresh `pnpm qa:db` |
| 6 Regression | main `pnpm qa` 66 GREEN / C1 / gate 0; gov-check OK | `pnpm qa`; `qa/reports/latest.md` |

## Verified contracts (cited)
- `campaign.routes.js:12` POST /campaigns = brandApproved
  (requireApproved → 403 if brand not approved).
- `campaign.controller.js`: :20 NOT_FOUND 404 (no brand
  profile); :190-193 start_date/end_date required; :452
  set_budget required for engagement/hybrid; :512 updateSet
  allowed includes set_budget (not budget); :550 deleteSet
  blocks last set (<=1 → 422); :900 publish needs ≥1 set; :909
  publish needs total_budget if engagement/hybrid; :942-974
  publish moves no money, status→'active'; :1031 publish
  returns `{ campaign }` only.

## Hard expectations (GOVERNANCE.md §8)
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Negative tests (422 name-missing; 403
  other-brand) left intact. Publish #1/#4 assert the deliberate
  evolved behaviour (status 'active', no wallet debit, no
  escrow_lock at publish) — documenting the verified contract,
  not masking.
- No test catching a genuine backend bug edited to pass — none
  here (every behaviour verified intentional; carve count 0).
  If the re-measure contradicts a class-2 call, reclassify →
  carve, honestly.
- Delta reported truthfully. Determinism → exact. Expected
  shape: the ~10 class-2/4 tests go green ⇒ ~23→~13 (the
  deterministic re-measure is authoritative; shared-helper
  blast radius decided by measurement, not assumption).
- migrations stay 53/53 0-error; main lane unchanged
  (Phase 11 = 2 test files; deploy-inert).

## Evidence
- `qa/artifacts/_p10_remeasure_qadb.log` (post-P10 inventory) +
  fresh `pnpm qa:db` (post-P11), classified inventory + delta
  in `lock.json` + `04-preview/README.md`, `qa/reports/
  latest.md` (main lane), gov-check pass on push.
