# Workflow Definition — Food World Phase 1 (customisation data model)

> Step 3. Each numbered step is an assertion target (API/DB).

## Actor
A follower (auth-optional reads) + the order path (logged-in follower).
Backend-only phase — workflow is API/DB observable, not UI.

## Preconditions
- One approved restaurant brand with ≥1 active, pushed_to_store dish.
- A dish seeded with: one variation group (single, required, items
  Half ₹70 / Full ₹114, Full default) + one add-on group ("Accompaniment",
  multi, max_select 2, items Roti +₹15, Coke +₹40).
- (For rating) ≥1 published restaurant_reviews row for the brand.

## Workflow steps (observable)
1. Apply migration 113 → `product_addon_groups`, `product_addon_items` exist;
   `brand_products` has `badge`, `is_featured`, `featured_sort`.
2. `GET /follower/products/:id` for the seeded dish → `product.addon_groups`
   has 2 groups, correct selection_type/is_variation/min/max, items with
   prices + the Full default flagged.
3. `GET /follower/products/:id` for a plain dish with no groups →
   `addon_groups: []`.
4. A section feed item for the seeded dish → carries `rating` (the brand's
   avg), `review_count`, `badge` (or null), `has_addons: true`.
5. A section feed item for a dish with no groups → `has_addons: false`.
6. Storefront payload brand block → carries `free_delivery` +
   `delivery_eta_min_mins`/`max` when set in listing_data (else false/null).
7. `POST /follower/orders` with an item carrying variation=Half +
   addons=[Coke] + note="extra spicy" → order places; line price =
   70 + 40 = 110 (not the ₹114 base).
8. After verify → `follower_orders.items_json` for that line contains the
   resolved `variation`, `selected_addons`, `note`, and `price: 110`.

## Success definition
- Migration applied; both new tables + 3 columns present.
- getProductDetail returns correctly-shaped nested addon_groups.
- Section payload carries rating/review_count/badge/has_addons.
- An order with customisation is priced server-side (variation sets base,
  add-ons stack) and the snapshot in items_json preserves variation +
  add-ons + note.
- `pnpm qa` GREEN (66) with zero regression; non-customised orders price
  byte-identically to pre-change.

## Failure / edge workflows
- Order item references an addon item_id not belonging to that product →
  422 VALIDATION_ERROR, no order.
- Non-food / no-customisation order → identical totals, fee, commission as
  before (proven by an unchanged existing order test).
- Migration re-run → no error (IF NOT EXISTS everywhere).
