# Feature Spec — Food World, Phase 1: customisation data model

> Step 2 of the contract-driven workflow. Agreed BEFORE any code.
> Part of the Food World build (follower v2). Memory: project_food_world.

## Problem / goal
The follower food world needs cross-restaurant dish sections + restaurant
storefronts where a dish can be customised (variations Half/Full + priced
add-on groups) and that customisation must survive into the order. Today the
DB has no add-on/variation model, the dish-section payload lacks rating/badge,
and checkout silently drops add-ons + cooking notes. Phase 1 lays the
**data-model + backend foundation** every later UI phase renders from. Role:
**follower** (consumes), **brand/restaurant owner** (defines data in Phase 2).

## Scope
- In scope:
  - New tables `product_addon_groups` + `product_addon_items` — one unified
    model for BOTH variations (single-select, sets base price) and add-on
    groups (multi-select, "select up to N", priced deltas).
  - New `brand_products` columns: `badge` (owner-set label), `is_featured`,
    `featured_sort` (the per-restaurant "famous dishes" carousel = Type B).
  - Dish-section payload enrichment: `rating`, `review_count` (brand-level,
    reusing restaurant_reviews), `badge`, `has_addons`.
  - `GET /follower/products/:id` (getProductDetail) returns nested
    `addon_groups` so the customise popup + dish-detail popup render from real
    data.
  - Restaurant storefront header surfaces `free_delivery` + delivery ETA
    (carried in `listing_data` jsonb — consistent with existing cuisines/
    cost_for_two/locality; no `brands` schema change).
  - Order path (placeOrder/verifyOrder) carries chosen variation +
    selected add-ons + cooking note into `follower_orders.items_json`
    (untyped jsonb — no migration) and prices them server-side
    (variation sets base, add-ons stack).
- Explicitly out of scope:
  - Owner editor UI to enter this data (Phase 2).
  - Mobile reskin / popup rebuild / storefront polish (Phases 3-4).
  - Mobile cart line-key + replace-dialog changes (Phase 5).
  - Structured nutrition, original/compare ("other apps") price — CUT.
  - Admin authoring of add-ons — CUT (owner-owned only).
  - Per-dish rating (impossible: restaurant_reviews has no product_id) —
    card shows the restaurant's rating.

## Surfaces touched
- App(s): backend (migrations + src). No web/mobile in this phase.
- Roles involved: follower (read), brand (data owner, Phase 2).

## Data / contracts
- New tables: `product_addon_groups`, `product_addon_items` (migration 113).
- New columns: `brand_products.badge`, `.is_featured`, `.featured_sort`.
- No `brands` ALTER — ETA + free_delivery ride in `brands.listing_data`.
- Changed API:
  - `GET /v1/follower/products/:product_id` — response `product` gains
    `addon_groups: [{ id,name,selection_type,is_variation,is_required,
    min_select,max_select,sort_order, items:[{id,name,price,is_default,
    sort_order}] }]`.
  - Section payload items (home/section/section-results) gain `rating`,
    `review_count`, `badge`, `has_addons`.
  - Storefront (`resolveBusinessStore`) brand block gains `free_delivery`,
    `delivery_eta_min_mins`, `delivery_eta_max_mins`.
  - `POST /v1/follower/orders` accepts per item: `variation
    {group_id,item_id}`, `addons [{group_id,item_id}]`, `note`.
- Money/units: rupees numeric(10,2) (house rule). Variation item price =
  ABSOLUTE base; add-on item price = +DELTA. Line = base + Σ add-ons.
  Server-side priced from DB — client prices never trusted.

## Non-functional
- Auth/role gates: unchanged (public reads auth-optional; orders follower-auth).
- Failure modes: addon item id not belonging to the product → rejected;
  customisation absent (non-food) → byte-identical pricing (regression guard);
  re-runnable additive migration.
