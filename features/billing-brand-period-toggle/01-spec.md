# billing-brand-period-toggle — Phase A11

> Brand-side rewire to the entitlements model + Monthly/Yearly toggle.
> Closes the user-visible gap between what admin can configure
> (A10/A10.5) and what the brand sees on `/dashboard/settings/subscription`.

## What ships

**Backend extension to `GET /v1/subscription-tiers` (public)**
- Response now includes per-tier `prices` array (`[{billing_period, price_inr, active, sort_order}]`) and `entitlements` array (`[{feature_key, label, category, feature_type, unit, included, quota_value, config}]`).
- Legacy fields (`monthly_price_inr`, `features_json`, `max_*`) retained for back-compat with anything still consuming the old shape.
- One DB call adds ~3 joins; payload grows from ~1.7 KB to ~6 KB. Acceptable.

**Backend extension to `POST /brands/me/subscription/upgrade`**
- Accepts optional `billing_period` ('monthly' default for back-compat).
- Looks up the matching active row in `subscription_prices` for (tier_id, billing_period) and uses that price + cycle length (30 days monthly / 365 yearly).
- Falls back to legacy `subscription_tiers.monthly_price_inr` when no price row exists for monthly (so older tier rows still upgrade-able).
- Returns 422 if `yearly` selected but no yearly price exists.
- Persists `subscription_price_id` on the new `brand_subscriptions` row + cycles invoice `period_end` by the right duration.

**Brand UI rewrite of `/dashboard/settings/subscription`**
- Monthly / Yearly toggle pill at the top of "Available plans"; "Save with yearly" hint when at least one tier has a yearly price.
- Each tier card swaps to the matching period price; shows "Save N% vs monthly" when both are set.
- Features list rendered per-tier from `entitlements`:
  - **boolean** → ✓ or ✗ with feature label
  - **quota** → ✓ + label + meta ("100 per cycle" / "Unlimited")
  - **config** → ✓ + label + meta ("State, 10 niches" for discover_filter / "City, up to 25 recipients" for open_group_broadcast)
  - **baseline** → ✓ + label (everyone gets it)
  - Grouped by category (Influencer / Campaigns / Products / Brand store / Support).
- "Choose <tier>" button passes the selected period; disabled with "Not available" if no price for that period.
- Error surfacing: non-success API responses display a red banner with code + message (no more silent empty).

## Quota popup wiring (already in place from A9)
Verify-twice correction: I previously claimed in the "pending things" report that QuotaWallModal wasn't wired. It actually IS wired in:
- `products/page.js` (createProduct ×2 sites)
- `campaigns/new/page.js` (createCampaign + createSet + inviteInfluencer)

A9 already did this work. No A11 touchup needed.

## Files
- `backend/src/controllers/subscription.controller.js` — extend `listTiers` + `upgrade`.
- `Packages/brand-web/lib/api.js` — `upgradeSubscription` now takes `billing_period`.
- `Packages/brand-web/app/dashboard/settings/subscription/page.js` — full rewrite.
- This contract.

## Out of scope
- Yearly Razorpay live mode (still A13).
- Per-feature enforcement (A12, founder-paced).
- Per-brand override (A14).

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING — Vercel redeploys brand-web; Render redeploys backend with extended endpoints. No migration. No mobile.
- Backward compatible: existing clients sending just `tier_key` continue to work (defaults to monthly).
