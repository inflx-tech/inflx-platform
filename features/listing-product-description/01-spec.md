# Spec — Product description field (drill-down listing)

## Problem
The drill-down listing flow (fashion / furniture) has **no field to enter a product
description** anywhere — not in the one-by-one stepper, not in the Excel bulk
template. Every product is created with `description = null`, so shopper-facing
surfaces and the brand's own inventory rows fall back to the category name
(e.g. "Shirt — charvitha") instead of real copy.

The backend already supports it: `brand_products.description` exists, and
`insertProducts` writes `it.description || null` — nothing ever sends a value.

## Goal
Let a brand write an optional description for each product, in both add paths.

## Scope
- **One-by-one stepper** (`listing/page.js`, Basics step): add an optional
  Description textarea under name/price/SKU. Carried into the batch item as
  `description`; shown on the Review step.
- **Excel bulk** (`listingBulk.service.js`): add a `Description` column to the
  generated per-leaf template and read it back in `buildItems` as `description`.
- No backend controller change — `batchCreate → insertProducts` already persists
  `it.description`. No migration.

## Out of scope
- Editing description (or anything else) after a product is listed — that belongs
  to the separate fashion **edit surface** follow-up (task already flagged).
- Standard (non-drill-down) verticals — they already collect description via their
  own product form.

## Gating
Applies to the drill-down add flow (fashion / furniture). Additive and optional —
existing products and other verticals are unaffected.
