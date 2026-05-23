# billing-pricing-service — extend pricing.service.js with L1 + L3 + classifyPath (Phase A3)

> **Phase A3 of the INFLX 3-Layer Revenue Model.** Extends the
> existing `pricing.service.js` (L2 — M037) with the L1 (subscription
> renewal) and L3 (path-based marketplace fee) computation primitives.
> No controller wiring yet — Phase A5 wires this into
> `transaction.controller.js` (L3) and Phase A6 wires this into the
> Razorpay mandate flow (L1).

## What ships
Three new pure-ish functions exported from `pricing.service.js`:

| Function | Purpose | Layer |
|---|---|---|
| `computeL1Renewal(brandId)` | Resolves the next-cycle ₹ charge from `brand_subscriptions` + `subscription_tiers`. Returns `{amount_inr, tier_key, source}`. | L1 |
| `classifyPath(client, {followerId, brandId, campaignInfluencerId})` | Returns `{path, influencer_id}` where path is `direct` / `influencer_direct` / `influencer_attributed`. Reads `campaign_influencers` + `attribution_clicks`. | L3 |
| `computeL3OnFollowerTxn({client, brandId, followerId, campaignInfluencerId, brandCategory, netAmount})` | The full per-transaction L3 fee: classifies path, looks up `categories.path_{a,b,c}_pct` via `_normalizeCategoryKey`. Falls back to `brands.platform_fee_pct` (legacy 8%) when category doesn't map. Returns `{fee_amount, fee_pct, path, category_key, source, influencer_id}`. | L3 |

Plus a cache helper `bustCategoryCache()` (60s TTL, same pattern as the
existing `bustEscrowTierCache`).

## brands.category → categories.category_key mapping
Hardcoded `CATEGORY_ALIASES` table in `pricing.service.js` for now:
`'salon' → 'salon_beauty'`, `'fashion_walkin' → 'fashion'`, etc.
TODO Phase A7+: move to DB-driven mapping so admin can add aliases
without code change. Pass-through behavior: if a raw category neither
aliases nor matches a `category_key` directly, the lookup misses and
the legacy `brands.platform_fee_pct` fallback kicks in.

## Backward compat / no-op posture
- Nothing reads `computeL1Renewal` until Phase A6.
- Nothing reads `computeL3OnFollowerTxn` until Phase A5.
- The legacy `record.platform_fee_pct || env.PLATFORM_FEE_PCT` math in
  `transaction.controller.js` keeps running. Zero runtime behavior
  change in this phase.

## Tests
`backend/tests/pricing-service.test.js`:
- `_normalizeCategoryKey` — 8 cases (aliases + pass-through + null).
- `computeL1Renewal` — 3 cases (no sub / active growth / cancelled).
- `classifyPath` — 3 cases (no CI no attribution; no CI active
  attribution; no CI expired attribution).
- `computeL3OnFollowerTxn` — 4 cases (salon Path A 9%, Path B 5%, Path
  C 7% from Glow Studio walkthrough; unknown category → fallback 8%).

`truncateAll` in `backend/tests/helpers/db.js` extended with the 3 new
runtime tables (`brand_subscriptions`, `subscription_invoices`,
`attribution_clicks`). Admin-config tables `subscription_tiers` +
`categories` are NOT truncated — same preservation pattern as
`escrow_fee_tiers` (M037).

## Files
- `backend/src/services/pricing.service.js` (extended)
- `backend/tests/pricing-service.test.js` (new)
- `backend/tests/helpers/db.js` (TRUNCATE list extended)
- This contract.

## Non-functional
- No new endpoints, no auth changes, no migration.
- Deploy posture: PRODUCTION-IMPACTING (`backend/src/**` touched) but
  behavior unchanged because no caller exists yet. Render redeploys
  the new image; service file present but inert until A5/A6.
