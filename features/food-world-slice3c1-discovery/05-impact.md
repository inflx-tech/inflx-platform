# 05 — Impact · 3C-1 Food home + discovery

**Verdict: additive home build + 3 backend changes. The new home rendering is
additive (existing food-home layout/section-engine/tracking untouched). The
backend changes are small and backward-compatible, but mig 118 makes this
PRODUCTION-IMPACTING — surfaced for explicit go.**

## Touched

Backend:
- `backend/migrations/118_brand_product_mrp.sql` — NEW (add `mrp` nullable).
- `backend/scripts/run-118.js` — NEW prod applier.
- `backend/src/services/sectionRules.service.js` — new `restaurants_with_featured`
  rule (Type B) + `etaFromDistanceKm` helper + `mrp` in `mapListedProductItem`.
- `backend/src/controllers/follower.controller.js` — `mrp` + computed ETA in
  dish-group restaurants; getProductDetail returns `mrp`.

Mobile:
- `services/api.js` — `getDishGroups`, `getDishGroupRestaurants` (additive).
- `components/food/DishGroupRail.js` — NEW.
- `screens/follower/DishGroupResultScreen.js` — NEW.
- `components/vibe/ShelfProductCard.js` — toing redesign + struck MRP + ＋
  (＋ wiring to popup deferred to 3C-2; lands on current product screen now).
- `components/food/RestaurantSection.js` — NEW Type-B renderer.
- `components/SectionRenderer.js` — new case for the Type-B shelf.
- `screens/follower/CategoryListScreen.js` — mount rail + chips filtering.
- `navigation/FollowerNavigator.js` — register result screen.

## Not touched

Order/cart/checkout, CartContext, RestaurantDetailScreen internals, offer
engine, existing brand/product rules' output (only `mrp` field added — additive),
other verticals.

## Release classification

**PRODUCTION-IMPACTING.** Migration 118 (Supabase) + backend rule/ETA (Render)
+ mobile OTA. Migration surfaced for explicit founder go; backend push + OTA
follow. `mrp` is nullable → zero effect on non-food / dishes without an MRP.

## Risks

- `mrp` additive nullable — no read-path breaks; struck price only when set.
- Type-B rule is a new read-only query — no write path, no migration.
- ETA helper changes displayed ETA everywhere distance is known; stored
  `delivery_eta_*` becomes unused (left in place, no removal this slice).
