# Before / after — MRP field

## What was implemented
An optional **MRP** (strike-through original price) for drill-down products, in the
add wizard, the edit form, and the Excel bulk template — enabling discount display
where previously only seeded/DB products had MRP.

- Stepper (`listing/page.js`): **MRP ₹** input beside Price on the Basics step
  (add + edit); `mrp` added to draft/item/edit-payload; struck-through MRP on Review.
- Create (`insertProducts`): INSERT extended to persist `mrp` (columns + placeholders
  re-numbered together; param mapping verified).
- Edit (`updateListingProduct`): mrp set / clear / keep semantics.
- Excel bulk (`listingBulk.service.js`): optional `MRP` column + `buildItems` read.

## What matches the mockup
- Optional MRP input next to Price; Review shows price with MRP struck through when
  `mrp > price`.

## What to check on the deployed screen
1. Add a product with MRP > Price → Review shows the strike-through; after save the
   inventory row shows `₹price  ₹MRP̶` (existing render).
2. Edit an existing product → change or clear MRP → saved correctly.
3. Excel template has an MRP column; filling it imports the MRP.
4. Leaving MRP blank → no strike-through, no error.

## Verification
- `pnpm qa` GREEN, gate 0 (2026-07-02).
- Backend `node --check` clean; listing page JSX parses via Next babel.
- Not exercised end-to-end in CI (no fashion products) — verify on prod: add/edit a
  Charvitha product with an MRP.
