# Before / after — Product description field

## What was implemented
An optional **Description** field for products created through the drill-down
listing flow, in both add paths — closing a gap where description could never be
entered and was always stored as `null`.

- One-by-one stepper (`listing/page.js`): Description textarea on the Basics step;
  `description` added to `blankDraft` + the staged batch item; rendered on Review.
- Excel bulk (`listingBulk.service.js`): optional `Description` column added to the
  generated template and read back in `buildItems`.
- Backend persistence unchanged — `insertProducts` already writes `it.description`.

## What matches the mockup
- Description textarea under the price/stock/SKU row on the Basics step, labelled
  optional, min height ~72px with vertical resize.

## What to check on the deployed screen
1. Add a fashion product one-by-one → the Description textarea appears on Basics;
   typed text shows on Review and persists (visible in the inventory row subtitle
   instead of the category fallback).
2. Download the Excel template for a leaf → it has a `Description` column; filling
   it imports the description.
3. Leaving description blank still works (persists null) — no new required field.

## Not included (separate follow-up)
- Editing description (or photos / facets / price) AFTER a product is listed — the
  fashion edit surface. This contract only adds description at create time.

## Verification
- `pnpm qa` GREEN, gate 0 (2026-07-02).
- Backend `node --check` clean; listing page JSX parses via Next babel.
- No fashion products exercised end-to-end by automated tests (no seed in CI DB);
  verify on prod with a real add.
