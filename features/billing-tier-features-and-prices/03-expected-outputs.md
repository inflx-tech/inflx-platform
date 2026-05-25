# Expected Outputs — billing-tier-features-and-prices (Phase A10)

## DB state after M061
- `features` table: 13 catalog rows (5 influencer / 2 campaigns / 2 products / 1 brand_store / 3 support).
- `tier_features` table: 52 rows (4 tiers × 13 features). Inclusion counts: Free 7 included, Growth 10, Pro 12, Enterprise 13.
- `subscription_prices` table: 4 monthly rows seeded (one per tier from existing monthly_price_inr); yearly rows admin-added later.
- `brand_subscriptions.subscription_price_id` column added; existing active rows backfilled to their tier's monthly price.

## Backend endpoints (12 new admin + 1 extended brand)
```
GET    /v1/admin/features                       list catalog
POST   /v1/admin/features                       create
PATCH  /v1/admin/features/:feature_key          update
DELETE /v1/admin/features/:feature_key          soft delete (active=false)

GET    /v1/admin/tiers/:tier_key/features       list tier × features
PUT    /v1/admin/tiers/:tier_key/features       bulk upsert

GET    /v1/admin/tiers/:tier_key/prices         list prices
POST   /v1/admin/tiers/:tier_key/prices         create / upsert by period
PATCH  /v1/admin/prices/:price_id               update price
DELETE /v1/admin/prices/:price_id               soft delete

(extended) GET /v1/brands/me/subscription       now includes entitlements{} map keyed by feature_key
```

## Entitlements lookup result
For any brand, `getEntitlements(brandId)` returns:
- `tier_id`, `tier_key`
- `entitlements`: Map of `feature_key → {included, quota_value, config, feature_type, is_enforced, category, label}`
- Layered: tier_features for active tier → catalog default. (A14 will add brand_overrides → tier_features → catalog.)

## Admin UI surfaces
- `/admin/pricing/tiers` — list with click-into-edit per tier.
- `/admin/pricing/tiers/:tier_key` — 3-section editor (basics + prices + features).
- `/admin/pricing/features` — catalog manager with add / edit / soft-delete.

## Tests
- pnpm qa stays GREEN; +1 nav-sweep route (/admin/pricing/features). Target 76/76.
- backend jest gets a new `features-and-entitlements.test.js` covering: catalog list, create + update + delete, tier_features upsert, entitlements service returns correct map per tier.

## Deploy posture
PRODUCTION-IMPACTING:
- Render redeploys backend with M061 migration runner queued + 1 new controller + extended subscription.controller.
- Vercel redeploys brand-web with 2 new admin pages + 1 rewritten + nav update.
- Mobile untouched → OTA skipped.

## What does NOT change
- Brand subscription page at `/dashboard/settings/subscription` keeps its current rendering (A11 will rewire it to read from entitlements).
- Existing quotaCheck middleware unchanged (still reads `subscription_tiers.max_*` columns); A12 contracts will migrate gates one-by-one to entitlements lookup.
- `subscription_tiers.monthly_price_inr` + `features_json` columns stay (deprecated, ignored by new admin code, still in DB for safety).
