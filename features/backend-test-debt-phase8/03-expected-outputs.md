# Expected Outputs — backend-test-debt Phase 8

> Step 3. Measured vs **333 passed / 49 failed / 382** (post-P7,
> deterministic instrument → noise-free delta).

## Per-step expected outputs
| Step | Observable output | Verified by |
|---|---|---|
| 1 Inventory | The 10 money-cluster failing tests (suite › test + signature) | jest summary cross-check |
| 2 Classify | Each 1/2/3/4 with controller/service `file:line` | inventory + offer.service/withdrawal/invite reads |
| 3 Align | 3 levers traceable to the cited contract line; values = verified rupees math | `git diff backend/tests/**` |
| 4 Carve | One `features/backend-defect-<slug>/` per NEW class-3; test RED | new carve folders (expect none) |
| 5 Re-measure | Honest delta vs 333/49 + inventory in `lock.json` | fresh `pnpm qa:db` |
| 6 Regression | main `pnpm qa` 66 GREEN / C1 / gate 0; gov-check OK | `pnpm qa`; `qa/reports/latest.md` |

## Verified rupees values (bill ₹1000, 30% pct, 8% comm, 8% fee)
- discount_amount **300**, net_amount **700**, original_amount
  **1000**, influencer_commission **56**, platform_fee **56**,
  brand_net **588** (700−56−56), conversion total_revenue
  **700**, commission_amount/pending/total **56**, prebook
  advance **200**, withdrawal too-small fixture **50** (< ₹100).

## Hard expectations (GOVERNANCE.md §8)
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Negative tests (401/403/409/422-missing) left
  intact. Every new value is the controller's verified-correct
  rupees output (cited), never reverse-engineered to green.
- No test catching a genuine backend bug edited to pass — carved
  RED instead (none expected; backend verified correct here).
- Delta reported truthfully even if small. Determinism → exact.
- Items honestly RECLASSIFIED OUT of the money cluster (payout-id
  format, set/wallet response-shape, topup boundary) are
  recorded as deferred, not silently dropped.
- migrations stay 53/53 0-error; main lane unchanged
  (Phase 8 = test-infra only; deploy-inert).

## Evidence
- `qa/artifacts/_p7_remeasure_qadb.log` (post-P7 inventory) +
  fresh `pnpm qa:db` (post-P8), classified inventory + delta in
  `lock.json` + `04-preview/README.md`, `qa/reports/latest.md`
  (main lane), gov-check pass on push.
