# Expected Outputs — billing-attribution-l3 (Phase A5)

## Files
- `backend/src/services/transaction.service.js` — `validateTracking` now exposes `brand_category`.
- `backend/src/controllers/transaction.controller.js`:
  - +1 import (pricingService)
  - pay-at-store createOrder: legacy platformFeePct math replaced with computeL3OnFollowerTxn; l3.path/category_key/source/influencer_id stashed in meta.
  - online_order createOrder: same.
  - prebook + prebook-daterange createOrder: unchanged (platformFeeAmount=0 by design).
  - All 4 verifyOrder sites: conditional attribution_clicks INSERT inside the existing DB transaction.
- `backend/tests/pay-at-store.test.js` — assertion update for Path B restaurant 4% (28 on net=700) instead of legacy 8% (56).

## Functional outcomes live
- Brand category drives the L3 fee — restaurant 8/4/6, salon 9/5/7, fashion 10/5/7, etc.
- Every Path B txn writes a 30-day attribution row.
- Path A/B/C all flow through the pricing service.
- API response shape (`breakdown.platform_fee`) unchanged.

## Test results
- pnpm qa main 67/67 GREEN.
- backend jest pay-at-store.test.js: PASSES with updated assertion.
- All other backend tests: unchanged (commission-based assertions decoupled from L3 changes).

## Deploy posture
PRODUCTION-IMPACTING. The L3 fee model is LIVE on push. Brands now
charged path-based fees instead of flat 8%. Material impact on
restaurant + fashion + salon transaction profitability.
