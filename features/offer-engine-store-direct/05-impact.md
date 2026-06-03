# Impact Analysis — offer-engine-store-direct (Sub-contract D2)

## Verdict (terse)
**Additive money path — zero disturbance to existing transactions.** Two new
follower endpoints + a fetch helper. The existing pay-at-store / order / prebook
flows and `validateTracking` are untouched; the new path is a parallel branch
that no client calls until D3.

## Mechanics
- **New functions, no edits to existing ones.** `initiateStoreOfferPay`/
  `verifyStoreOfferPay` are added alongside `initiatePayAtStore`/`verifyPayAtStore`;
  the latter are byte-unchanged. New routes are additive.
- **No migration.** Uses `follower_transactions.brand_offer_id` + `offer_source`
  (085, D1). The 4 tracking IDs are already nullable, so a fully-null-tracking row
  is schema-valid.
- **Commission is hard-zero.** `influencer_commission=0`, no
  `creditInfluencerCommission`, no `attribution_clicks` write → no influencer is
  ever paid or attributed on a store-direct sale.
- **Reuses tested money primitives.** `resolveOfferDiscount` (discount),
  `pricingService.computeL3OnFollowerTxn` with `campaignInfluencerId=null`
  (classifies `'direct'` — already handles null), `createOrder`/`consumeMockOrder`
  (stashed-meta amounts, mock-safe), `settleCommerceTransaction` (brand net).
  Amounts are computed at initiate and used verbatim at verify — same safety
  model as pay-at-store.
- **Ownership + lifecycle enforced** in `fetchStoreOfferOrThrow`
  (brand match + published + active + window) → cross-brand/unavailable → 409.

## Blast radius if it failed
Confined to the two new endpoints; nothing calls them until D3. A bug cannot
affect existing influencer purchases (separate functions, separate routes,
`validateTracking` untouched).

## Regression guard
`offer-store-direct.test.js` 4/4 GREEN; `pay-at-store.test.js` 10F/1P **identical**
with vs without this change (stash baseline) — pre-existing harness debt, not a
regression. Existing transaction flows unchanged.

## Deploy posture
PRODUCTION-IMPACTING (`backend/src`) but DORMANT. Backend-only → Render
auto-deploy; no migration, no OTA/web. Surfaced for explicit go.
