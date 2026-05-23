# Workflow — billing-quota-middleware (Phase A4)

## Actor
Brand on the brand-web Products page hitting their tier limit.

## Preconditions
- M058 (Phase A1) applied; subscription_tiers + categories seeded.
- Brand has an active `brand_subscriptions` row OR none (middleware
  lazy-creates free).

## Steps
1. Brand on Free tier creates products via UI; first 10 succeed.
2. Brand clicks "Add Product" the 11th time → POST /v1/brands/me/products.
3. Middleware reads `subscription_tiers.max_products = 10`, counts
   `brand_products` for the brand = 10, returns 422 QUOTA_EXCEEDED with
   `details: { action, used:10, limit:10, current_tier:'free', upgrade_to:['growth','pro','enterprise'] }`.
4. Brand-web shows the upgrade modal (Phase A7 UI) with the upgrade tiers.
5. Brand clicks Upgrade → flows to Phase A6 mandate signup.

## Success
- 422 fires at exactly limit+1 (not before).
- Enterprise tier never hits 422.
- New `brand_subscriptions` row created on first call for an unsubscribed brand.

## Failure modes
- subscription_tiers seed missing → middleware throws INTERNAL_ERROR
  (visible in Render logs). Self-healing on first M058 apply.
- Unknown action key passed to `checkQuota('foo')` → throws at module
  load time (early failure, prevents shipping broken middleware).
