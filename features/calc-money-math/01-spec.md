# Feature Spec — Money-math invariants (B2a)

> Contract B2a of Area B (L1, pure-calc). Step 2. Implementation
> GATED on `lock.json.approved = true`. B2b (Docker DB substrate for
> status-transition/flow coverage) is the committed next contract.

## Problem / goal
Commission / platform-fee / brand_net is the highest-risk business
logic in INFLX (every rupee of creator attribution + brand
settlement flows through it). It currently has **zero** automated
coverage. It is computed by two **pure, exported** functions —
`calcPayAtStore` / `calcOnlineOrder` in
`backend/src/services/transaction.service.js` — so it can be locked
deterministically with no DB, Docker, live backend, or app change.

## Verified formulas (source of truth for assertions)
`r2 = (n) => parseFloat((n||0).toFixed(2))` (2-dp rupees).

**calcPayAtStore(bill, discPct, commPct, feePct):**
- discountAmount = r2(bill·disc/100)
- netAmount = r2(bill − discountAmount)
- influencerCommission = r2(net·comm/100)
- platformFee = r2(net·fee/100)
- brandNet = r2(net − influencerCommission − platformFee)

**calcOnlineOrder(products[{price,quantity}], discPct, commPct, feePct, deliveryFee=0):**
- itemsTotal = r2(Σ price·qty)
- discountAmount = r2(itemsTotal·disc/100)
- discountedItems = r2(itemsTotal − discountAmount)
- netAmount = r2(discountedItems + deliveryFee)
- influencerCommission = r2(discountedItems·comm/100)
- platformFee = r2(discountedItems·fee/100)
- brandNet = r2(discountedItems − influencerCommission − platformFee)

## Scope
- In scope: assert both functions over clean fixed cases + the
  structural **invariants** (fee = r2(base·feePct/100); brandNet =
  r2(base − comm − fee); discount = r2(base·disc/100); zero/empty
  inputs → zeros; default platform fee 8% from CLAUDE.md).
- Out of scope: anything DB-coupled (status machines, persistence,
  end-to-end txn) → **B2b** (Docker substrate, committed next).

## Surfaces touched
- Imports `backend/src/services/transaction.service.js` (read-only).
  No app code. No migration, mobile, OTA. **Deploy-inert.**
- Adds `unit/**/*.spec.ts` to `qa/playwright.config.ts` testMatch
  (additive).

## Non-functional
- Fully deterministic, offline, sub-second. Invariants computed in
  the test via an r2 mirror so exactness doesn't depend on hand
  pre-computed fragile float literals.
