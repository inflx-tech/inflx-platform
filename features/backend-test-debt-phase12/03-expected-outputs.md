# Expected Outputs — backend-test-debt Phase 12

> Step 3. Measured vs **368 passed / 14 failed / 382** (post-P11,
> deterministic instrument → noise-free delta).

## Per-step expected outputs
| Step | Observable output | Verified by |
|---|---|---|
| 1 Inventory | 14 = 4 carved (RED) + 10 class-2/4 | jest summary cross-check |
| 2 Classify | Each of the 10 with controller/service/schema `file:line` | code reads (conclusive) |
| 3 Align | 8 fix-sites traceable to the cited verified contract | `git diff` of the test files |
| 4 Carve | One `features/backend-defect-<slug>/` per genuine class-3 | none expected |
| 5 Re-measure | Honest delta vs 368/14 + final ledger + true split | fresh `pnpm qa:db` |
| 6 Regression | main `pnpm qa` 66 GREEN / C1 / gate 0; gov-check OK | `pnpm qa`; `qa/reports/latest.md` |

## Verified contracts (cited)
- wallet.controller.js:68-74 (`data.wallet.{wallet_balance,…}`),
  :104 (`amount: amountPaise`); escrow.service.js:115
  (`tranche_<n>_<ts>`); brand.controller.js:121-128 (name/city/
  state required); influencer.controller.js:205 (name required);
  contract.controller.js:504-530 (formats_json or brand-sign
  500) + follower.service.js:105 (`ACTIVE_CI_QUERY ci.status IN
  contracted/active/completed`); engagement.service.js:151-163
  (`totals:{total_likes,total_comments,total_views,avg_er}`).

## Hard expectations (GOVERNANCE.md §8)
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Negative tests (401/403/404/422-missing) + the
  passing sibling wallet test (campaigns.test.js:764) left
  intact. Engagement re-pointed to the REAL totals fields
  (documents the evolved contract — not weakening).
- The 4 carved genuine defects stay RED, untouched.
- Delta reported truthfully. Determinism → exact. Expected
  shape: the 10 class-2/4 go green ⇒ 14→4 (the 4 carves), the
  deterministic re-measure is authoritative.
- migrations stay 53/53 0-error; main lane unchanged
  (Phase 12 = test files only; deploy-inert).
- Final report MUST state the true split: total fixed across
  P1-P12 vs the N genuine carved defects remaining.

## Evidence
- `qa/artifacts/_p11_remeasure_qadb.log` (post-P11 inventory) +
  fresh `pnpm qa:db` (post-P12), classified inventory + final
  ledger + split in `lock.json` + `04-preview/README.md`,
  `qa/reports/latest.md` (main lane), gov-check pass on push.
