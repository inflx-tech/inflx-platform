# Workflow Definition — Food World Phase 2: owner editor

> Step 3. Each numbered step is an assertion in the QA workflow test.

## Actor
Logged-in brand (restaurant), approved, owns its `brand_products`.

## Preconditions
A restaurant brand with at least one dish (`brand_products` row), e.g.
"Chicken curry" base price ₹114.

## Workflow steps (user-observable)
1. Owner opens a dish's "Customise" modal → sees empty variations + add-on
   sections (or the previously saved ones).
2. Owner adds a variation group "Portion" (single, required) with options
   Half ₹70 (default) and Full ₹114 → saved.
3. Owner adds an add-on group "Accompaniment" (multi, max 3, optional) with
   Roti +₹15, Chapathi +₹15; and "Beverage" (multi, max 2) with Coke +₹40.
4. Owner taps "Pull from my menu" → picks an existing dish → it prefills the
   add-on name + price and records `source_product_id`.
5. Owner sets badge = "Popular" and toggles Featured on → saved on the dish.
6. Owner sets restaurant delivery: Free delivery ON, ETA 20–25 mins → saved.
7. Re-opening the modal shows everything persisted (round-trips).

## Success definition
- `POST /brands/me/products/:id/addon-groups` persists the groups+items;
  `GET` returns them in the nested shape; the follower `GET /products/:id`
  (Phase 1) returns the same `addon_groups`.
- `PATCH /brands/me/products/:id` persists `badge`/`is_featured`/`featured_sort`.
- `PATCH /brands/me` persists delivery fields into `listing_data`.
- A subsequent order for that dish prices correctly (Phase-1 pricer) and the
  snapshot carries the chosen variation + add-ons.

## Failure / edge workflows
- Non-owner brand calls the addon endpoint for another brand's product → 403,
  no write.
- `is_variation:true` with `selection_type:'multi'` → 422.
- Group with zero items, or item with negative price → 422, no partial write.
- Bulk-replace with fewer groups removes the dropped ones but leaves prior
  orders' `items_json` snapshots intact.
