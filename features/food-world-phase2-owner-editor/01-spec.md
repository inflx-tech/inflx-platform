# Feature Spec — Food World Phase 2: restaurant owner editor

> Step 2. Agreed before code. Builds on the Phase-1 data model
> (`features/food-world-phase1-customisation`, migration 113).

## Problem / goal
Phase 1 shipped the customisation data model (variations + add-on groups +
badge/featured + delivery fields), but there is **no owner-facing way to enter
that data** — so every dish still returns `addon_groups: []`. This contract gives
the restaurant **owner** (role: brand, category=restaurant) the tooling to
define, per dish: portion variations (Half/Full, priced), add-on groups
(multi, "select up to N", priced), a badge, and a featured-dish flag; plus
restaurant-level free-delivery + delivery ETA.

## Scope
- In scope:
  - Backend write API: bulk-replace addon groups/items per product; `badge` /
    `is_featured` / `featured_sort` writable on the product; delivery
    settings (free-delivery + ETA) via existing `listing_data`.
  - brand-web UI: a per-dish "Customise" **modal** in the restaurant menu
    editor (variations + add-on groups + "pull from my menu" assist + badge +
    featured), and a restaurant-level delivery-settings control.
- Explicitly out of scope:
  - Mobile authoring (the brand mobile app has no product editor; not built).
  - Follower-side rendering (that is Phase 3).
  - Per-add-on veg mark — add-ons inherit veg from their source menu item;
    freehand add-ons carry none. (Founder-locked 2026-06-21.)
  - Other-apps / original-price (cut in Phase 1).

## Surfaces touched
- App(s): backend, brand-web. (No mobile, no admin.)
- Roles involved: brand (restaurant owner). Ownership-guarded.

## Data / contracts
- New tables: none (Phase 1 created `product_addon_groups` /
  `product_addon_items` + `brand_products.badge/is_featured/featured_sort`).
- New/changed API:
  - `GET  /brands/me/products/:productId/addon-groups` → `{ groups:[...] }`
    (nested groups+items; same shape as the follower read).
  - `POST /brands/me/products/:productId/addon-groups` — bulk-replace the
    product's addon groups+items. Body `{ groups:[{name,selection_type,
    is_variation,is_required,min_select,max_select,sort_order,
    items:[{name,price,is_default,source_product_id?,sort_order}]}] }`.
  - `PATCH /brands/me/products/:pid` — add `badge`, `is_featured`,
    `featured_sort` to the allow-list.
  - Delivery settings reuse `PATCH /brands/me` `listing_data` (free_delivery,
    delivery_eta_min, delivery_eta_max) — no new endpoint.
- Money/units: rupees `numeric(10,2)`. Variation item price = absolute base;
  add-on item price = +delta. Matches the Phase-1 order pricer.

## Non-functional
- Auth/role gates: `authenticate` + `requireRole('brand')`; every addon write
  asserts the product belongs to the caller's brand (mirror
  `productVariants.controller.assertProductOwnership`).
- Failure modes: bulk-replace is transactional; a hard delete+reinsert is safe
  because `follower_orders.items_json` is a value snapshot (no FK to addon
  rows) — historical orders are untouched. Invalid group/item shapes → 422,
  no partial write.
