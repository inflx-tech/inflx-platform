# Workflow — billing-admin-ui (Phase A7-admin)

## Actor
Logged-in admin (superadmin for edits; any admin for read).

## Preconditions
A1-A6 + A8 shipped. M058 + M059 applied on prod.

## Steps — superadmin editing a tier
1. Admin opens `/admin/pricing/tiers` → 4 tier rows render with current values.
2. Clicks **Edit Tiers** → all rows become inline-editable.
3. Changes Growth `monthly_price_inr` from 2499 → 2999, `max_products` from 100 → 150.
4. Clicks **Save Changes** → confirm dialog → 1 PATCH per row → toast `Subscription tiers updated` → reload.
5. Next brand who calls POST `/v1/brands/me/subscription/upgrade {tier_key:'growth'}` is charged ₹2999; their quota wall jumps to 150 products.

## Steps — superadmin editing category path %
1. Admin opens `/admin/pricing/categories` → 16 category rows render.
2. Clicks **Edit** on `salon_beauty` row.
3. Changes `path_b_pct` from 5 → 6.
4. Clicks **Save** on that row → PATCH → cache busted via `pricingService.bustCategoryCache()` → toast `Saved salon_beauty`.
5. Next Path-B salon transaction within ~60s uses 6% (or sooner if backend restarts).

## Steps — superadmin adding a new category
1. Clicks **+ Add Category** → inline form opens.
2. Fills `category_key='spa_wellness'`, `name='spa_wellness'`, `label='Spa & Wellness'`, A=10, B=5, C=7.
3. Clicks **Add** → POST → category appears in the list → cache busted.

## Steps — admin viewing active subs / invoices
- `/admin/subscriptions?status=active` → list of brand_subscriptions joined to brand + tier with cycle dates + mandate state.
- `/admin/billing/invoices?status=paid` → invoice rows + running paid-sum.

## Success
- All 4 pages render under admin auth.
- nav-sweep spec passes for `/admin/pricing/tiers`, `/admin/pricing/categories`, `/admin/subscriptions`, `/admin/billing/invoices`.
- All 7 new backend admin tests pass.
- `pnpm qa` 67+4=71 routes scanned, all GREEN.

## Failure modes
- Non-superadmin attempting PATCH → 403 FORBIDDEN (tested).
- DELETE category that brands are registered under → brands fall back to legacy `brands.platform_fee_pct` (8%) via pricing.service `brand_legacy_fallback` source (already covered in A3 tests).
- Invalid PATCH payload (e.g. price < 0) → 422 VALIDATION_ERROR with field name (tested via _validate).
