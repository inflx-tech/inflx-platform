# Spec — MRP (strike-through price) for drill-down products

## Problem
The drill-down add/edit form captures **Price** (what the shopper pays) but not
**MRP** (the original price shown struck-through to signal a discount). The
`brand_products.mrp` column exists and the inventory + storefront render a
strike-through when `mrp > price`, but a brand adding/editing a product through the
wizard can never set it — so real products show a single price with no discount
anchor. (Only seeded/DB-set products had MRP.)

## Goal
Let a brand set an optional MRP when adding or editing a drill-down product, in the
one-by-one wizard and the Excel bulk template.

## Scope
- **Stepper (`listing/page.js`, Basics step):** optional **MRP ₹** input beside
  Price. Carried on the item as `mrp`; shown struck-through on Review when
  `mrp > price`. Works in both add and edit mode (shared form).
- **Create (`insertProducts`):** persist `it.mrp` into `brand_products.mrp`.
- **Edit (`updateListingProduct`):** already accepts `mrp`; now supports set / clear
  / leave-as-is (undefined = keep, null/'' = clear, number = set).
- **Excel bulk (`listingBulk.service.js`):** optional `MRP` column in the generated
  template + read back in `buildItems`.

## Out of scope
- Any pricing logic beyond storing MRP (no min/max validation; the UI only shows the
  strike-through when `mrp > price`).

## Gating
Drill-down verticals (fashion / furniture). Optional field — no new required input,
no behaviour change for products left without an MRP.
