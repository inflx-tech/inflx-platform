# Expected Outputs — billing-pricing-service (Phase A3)

## Exports added to pricing.service.js
- `computeL1Renewal(brandId)` → `{amount_inr, tier_key, source}`
- `classifyPath(client, args)` → `{path, influencer_id}`
- `computeL3OnFollowerTxn(args)` → `{fee_amount, fee_pct, path, category_key, source, influencer_id}`
- `bustCategoryCache()`
- `_normalizeCategoryKey(rawCategory)` (test-exposed)
- `CATEGORY_ALIASES` (test-exposed)

Existing L2 exports unchanged.

## Test results (backend jest, qa:db lane)
- `pricing-service.test.js` — 18 assertions across 4 describe blocks, all GREEN.
- Prior backend jest suite: zero regression.
- Glow Studio reconciliation slices proven:
  - Anita Path B salon ₹2,000 → fee_pct=5, fee_amount=₹100
  - Anita Path C salon ₹3,000 → fee_pct=7, fee_amount=₹210
  - Rahul Path A salon ₹1,500 → fee_pct=9, fee_amount=₹135

## pnpm qa main lane
67/67 GREEN, STATE=GREEN, gate=0 — unchanged (no controllers modified).
