# billing-attribution-l3 — L3 fee wiring + attribution writes (Phase A5)

> **Phase A5 of the INFLX 3-Layer Revenue Model.** This is the phase
> where the L3 marketplace fee actually starts running for live
> follower transactions. Replaces the legacy `record.platform_fee_pct ||
> env.PLATFORM_FEE_PCT` math in `transaction.controller.js` with
> `pricingService.computeL3OnFollowerTxn`. Also writes
> `attribution_clicks` rows on Path B transactions so future direct
> buys by the same follower fall into Path C.

## What ships
- `backend/src/services/transaction.service.js` — `validateTracking`
  now SELECTs `b.category AS brand_category` so the controller has it
  for the L3 lookup.
- `backend/src/controllers/transaction.controller.js`:
  - Imports `pricingService`.
  - Pay-at-store + online_order createOrder sites now call
    `pricingService.computeL3OnFollowerTxn` and use `l3.fee_amount` as
    the platform fee. Old `platformFeePct` math removed.
  - prebook + prebook-daterange unchanged (platformFeeAmount=0 by
    design — advance/token has no fee line).
  - All 4 verifyOrder sites: after the follower_transaction INSERT,
    conditionally write `attribution_clicks (follower, influencer,
    brand, campaign, expires_at=now+30d)` when CI is present.
- `backend/tests/pay-at-store.test.js`: assertion update to reflect
  new Path B restaurant 4% fee (was 8% under legacy).

## Path semantics live now
- **Path A (direct)** — no CI on the transaction, no active
  attribution. L3% = `categories.path_a_pct` for the brand's mapped
  category, or `brands.platform_fee_pct` (legacy 8%) fallback.
- **Path B (influencer_direct)** — CI present. Lowest L3% (volume play).
  Writes a 30-day attribution_clicks row at txn-complete time so
  future Path C buys earn the influencer attribution-commission.
- **Path C (influencer_attributed)** — no CI on this txn, but an
  unexpired attribution_clicks row exists. Middle L3%, plus the
  attributed influencer is recorded for commission purposes
  downstream (Phase A6 cron handles attribution-commission credit).

## API surface
- Response shape unchanged. `breakdown.platform_fee` still in the
  JSON envelope (the SELECT-AS aliases from Phase A2 keep the wire
  format stable). Internal `platformFee` JS variable name retained.

## Tests
- `pay-at-store.test.js` — existing test updated to expect Path B
  restaurant 4% (28 on net=700) instead of legacy 8% (56). The
  influencer_commission assertion stays 56 (commission is
  contract-based via ci.commission_pct, not pricing-service).
- Existing pricing-service.test.js already validates the L3 math —
  no new tests in this phase (the wiring is what's new; the math is
  covered).

## Backward compat / risk
- Brands with category that DOESN'T map to a `categories.category_key`
  → fallback to `brands.platform_fee_pct` (legacy 8%). Behavior
  preserved for unmapped brands.
- Mapped brands (most via CATEGORY_ALIASES) now charge the new
  path-based percentages. For restaurant, fashion, salon etc. fees
  CHANGE materially: lower on Path B/C, equal or higher on Path A.
- This is INTENTIONAL — the entire revenue model rests on this shift.
