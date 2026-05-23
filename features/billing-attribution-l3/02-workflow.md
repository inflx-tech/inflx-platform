# Workflow — billing-attribution-l3 (Phase A5)

## Actor
Follower paying at store / placing online_order through an influencer's
share link.

## Preconditions
- M058 + M059 applied. categories seeded. brand has a valid category.
- Active CI for the offer.

## Steps (Path B)
1. Follower clicks influencer's `inflx.in/s/<handle>?cid=...&iid=...` → store landing.
2. Follower hits POST /v1/follower/pay-at-store with bill_amount + CI ids.
3. Controller calls `validateTracking` → record includes brand_category.
4. Controller calls `pricingService.computeL3OnFollowerTxn(client, …)` →
   returns `{ fee_amount, fee_pct, path: 'influencer_direct', category_key, source, influencer_id }`.
5. Razorpay order created with the new fee in the meta.
6. Follower pays. POST /v1/follower/pay-at-store/verify fires.
7. Inside the DB transaction: follower_transactions INSERT (with new
   marketplace_fee_amount) + creditInfluencerCommission +
   attribution_clicks INSERT (30-day window).
8. Influencer's pending_balance += commission. Attribution recorded.

## Steps (Path C — later txn)
1. Same follower, same brand, no link click this time.
2. POST /v1/follower/pay-at-store with bill_amount, NO campaign_influencer_id.
3. classifyPath finds the unexpired attribution_clicks row → returns
   `path: 'influencer_attributed', influencer_id: <prior_inf>`.
4. L3% = Path C rate (higher than Path B).
5. follower_transaction INSERT records the L3 fee; no NEW attribution
   write (CI was null).

## Success
- Every pay-at-store / online_order transaction charges the right
  category × path L3 fee.
- Path B transactions leave a 30-day attribution_clicks row.
- pnpm qa main GREEN unchanged.

## Failure modes
- brand.category doesn't map → fallback to legacy 8%. No error.
- categories row inactive → fallback. No error.
- attribution_clicks unique-conflict (none today; index is non-unique) → impossible.
