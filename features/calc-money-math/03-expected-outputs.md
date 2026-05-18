# Expected Outputs — Money-math invariants (B2a)

> Step 3 (cont.). Asserted by the QA report. Defined BEFORE code.

## Fixed-case expected outputs
| Case | Call | Expected |
|---|---|---|
| C1 | calcPayAtStore(1000,10,5,8) | discount 100, net 900, comm 45, fee 72, brandNet 783 |
| C2 | calcPayAtStore(1000,0,0,8) | discount 0, net 1000, comm 0, fee 80, brandNet 920 |
| C3 | calcPayAtStore(0,10,5,8) | all 0 |
| C4 | calcOnlineOrder([{200,2},{100,1}],10,5,8,30) | itemsTotal 500, discount 50, net 480, comm 22.5, fee 36, brandNet 391.5 |
| C5 | calcOnlineOrder([],10,5,8) | itemsTotal 0, all 0 |

## Invariant expected outputs (I1, sampled)
For every sampled (base,disc,comm,fee):
- `platformFee === r2(base*fee/100)`
- `influencerCommission === r2(base*comm/100)`
- `brandNet === r2(base - influencerCommission - platformFee)`
- `discountAmount === r2(base*disc/100)`
(base = bill for pay-at-store; discountedItems for online order)

## Business rule locked
- Platform fee default **8%** of net/discounted base (CLAUDE.md
  Appendix B) — C1/C2 pin the 8% literal.
- brand_net is exactly `net − influencer_commission − platform_fee`,
  2-dp rounded — the settlement identity.

## Evidence
No screenshots (pure unit). QA-report rows + the asserted
numeric values in test titles/messages are the evidence; a failure
prints expected vs received per field.

## Implemented by (after lock)
`qa/unit/money-math.spec.ts` requiring
`backend/src/services/transaction.service` (exported
`calcPayAtStore`,`calcOnlineOrder`). `qa/playwright.config.ts`
testMatch gains `unit/**/*.spec.ts`. Green in `qa/reports/latest.md`.
