# Before/After Diff Notes — Food World Phase 1 (customisation data model)

> Backend-only contract. This file exists to satisfy gov-check Rule 4
> (GOVERNANCE.md §4b) for the bundled push — same precedent as
> `features/meals-schema` (a backend contract carrying the UI-gate
> attestation when its changeset is pushed alongside UI-governed files).

## Why a backend contract has diff notes
This contract changes only `backend/migrations/**` + `backend/src/**` — it
has **no UI surface and no mockup**. It was pushed on shared `main` together
with two unrelated, already-committed parallel-window commits
(`59ffcbf`, `31e0154`) that touch `Packages/Mobile/src/screens/follower/
HomeScreen.js` (the follower "See all" rail). gov-check scans the combined
base..HEAD diff, sees that Mobile file, and requires the touched contract to
carry 06-diff notes. The HomeScreen.js change is NOT part of this contract;
it belongs to the follower "See all" work and ships via OTA separately.

## What this contract implemented (verified, not mocked)
- Migration 113: `product_addon_groups` + `product_addon_items` (unified
  variation + add-on model); `brand_products.badge/is_featured/featured_sort`.
- `getProductDetail` → nested `addon_groups`.
- Dish-section payload → `rating`, `review_count`, `badge`, `has_addons`.
- Storefront brand header → `free_delivery` + delivery ETA (from listing_data).
- `placeOrder` → variation + add-ons resolved + priced server-side, carried
  into `items_json` with the cooking note.

## What matches the spec
All of 03-expected-outputs.md, proven by `tests/food-customisation.test.js`
(6/6 pass on real Postgres): addon_groups shape, empty-for-plain-dish, section
enrichment (rating 4.5 / review_count 2 / badge / has_addons), order pricing
(Half ₹70 + Coke ₹40 = ₹110 with snapshot preserved), regression (no
customisation → ₹114 base), security (cross-product add-on → 422).

## What diverged
Nothing functional. ETA + free_delivery ride in `brands.listing_data` (jsonb)
instead of new columns — a deliberate simplification (cuisines/cost_for_two
already live there), recorded in 01-spec.md.

## What to check post-deploy
- `pnpm qa` GREEN (79) pre-push.
- Render redeploys backend; no OTA in this phase.
- Migration 113 already applied to Supabase prod (run-113.js) before push.
