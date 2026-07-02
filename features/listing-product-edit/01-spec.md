# Spec — Edit a listed drill-down product

## Problem
Once a fashion / furniture product is listed, there is **no way to edit it** — a
brand cannot change the price, add or replace photos, adjust colours/sizes, fix the
description, or change stock. The drill-down wizard only creates; the inventory
browse offers only Hide/Show + Remove. The one edit modal in this area
(`CustomiseDishModal`) is wired for restaurant only. And the generic product PATCH
(`brand.controller.updateProduct`) does not accept `facets`, so even a hand-rolled
edit would silently drop colour/size changes.

## Goal
Let a brand fully edit a listed drill-down product — photos, name, brand, price,
description, stock, facets, and per-colour photos + per-size stock — reusing the
exact add-wizard form so create and edit can never diverge.

## Approach
Reuse the drill-down add stepper in an **edit mode** reached at
`/dashboard/products/listing?edit=<productId>`:
- The product is loaded into the stepper's own state (leaf + facet schema +
  pre-filled draft), so every existing field renderer (photos, facets, variant
  matrix, description) works unchanged.
- The final action **Save changes** PATCHes the one product instead of appending to
  a batch. Tabs, tree grid, bulk tabs, and the staged-items list are hidden in edit
  mode; nav becomes Cancel / Save changes.

## Scope
- **Entry points:** an **Edit** action on the inventory rows in BOTH browse paths —
  `BrowseListings` (My listings tab) and `DrilldownFleetView` (ListingTemplateLayout
  FleetView) — linking to `?edit=<id>`.
- **Backend (new, brand-scoped):**
  - `GET /brands/me/listing-products/:id` — the product + its leaf node + facet
    schema, for the edit form.
  - `PATCH /brands/me/listing-products/:id` — update using the SAME item shape +
    `taxonomy.validateItem` + `buildVariants`/`coverImage` as create. Leaf and SKU
    are preserved; `facets` (incl. brand/_images) and `variants_json` rebuilt
    exactly like `insertProducts`.

## Out of scope
- Re-categorising a product to a different leaf (that's a move, not an edit).
- Editing MRP via a new UI field (MRP is preserved as-is; the add flow doesn't
  capture it either).
- Non-drill-down verticals (they already have their own product edit).

## Gating
Drill-down verticals (fashion / furniture). The PATCH refuses a product with no
`category_node_id`.
