# Before / after — Edit a listed drill-down product

## What was implemented
An edit surface for fashion/furniture products, reachable at
`/dashboard/products/listing?edit=<productId>` from an **Edit** action on the
inventory rows in both browse paths.

- Backend: `getListingProduct` (read product + leaf + facet schema) and
  `updateListingProduct` (validated update) — the update reuses the create path's
  `taxonomy.validateItem`, `buildVariants`, `coverImage`, and facets/brand/_images
  assembly, so edit can't diverge from add. Leaf + SKU preserved; MRP preserved.
- Frontend: the drill-down stepper runs in edit mode — product pre-loaded into
  its state, tabs/tree/bulk/staged-list hidden, Save changes / Cancel nav.
- Edit action added to `BrowseListings` rows and `DrilldownFleetView` rows.

## What matches the mockup
- Edit header, pre-filled Basics (photos/name/brand/price/stock/description), SKU
  shown as fixed, Save changes / Cancel.

## What to check on the deployed screen
1. From inventory (either browse), tap Edit on a product → the stepper opens
   pre-filled with that product's photos, name, price, description, colours/sizes.
2. Change the price / add a cover photo / edit description / toggle a size → Save
   changes → returns to My listings; the row reflects the change and it persists on
   reload.
3. Edit a facet (e.g. add a colour) → saved (the new validated PATCH accepts
   facets, unlike the generic product PATCH).
4. Cancel returns without changes. A required facet left empty blocks Save with the
   same inline hint as add.
5. Add flow is unchanged when no `?edit` param is present.

## Deliberate limits
- No leaf re-categorisation, no MRP field (MRP preserved as-is). Add flow doesn't
  capture MRP either — a separate small enhancement if wanted.

## Verification
- `pnpm qa` GREEN, gate 0 (2026-07-02).
- Backend `node --check` clean; both edited pages parse via Next babel.
- No fashion products in the CI DB, so edit was not exercised end-to-end by an
  automated test — verify on prod with Charvitha's seeded products.
