# Impact

**Chat verdict:** additive optional field. Enables discount display; no migration
(`brand_products.mrp` already exists), no required-field change.

## Surface area
### Frontend (UI-governed)
- `Packages/brand-web/app/dashboard/products/listing/page.js` — MRP input on the
  Basics step (add + edit); `mrp` in `blankDraft` + the add item + the edit save
  payload; struck-through MRP on Review.

### Backend (governed, additive)
- `backend/src/controllers/listing.controller.js` — `insertProducts` now writes
  `mrp` (create path). `updateListingProduct` mrp handling extended to
  set/clear/keep.
- `backend/src/services/listingBulk.service.js` — optional `MRP` column in the
  generated template + read in `buildItems`.

## Blast radius / risk
- **Required validation:** unchanged — MRP is optional.
- **Existing products:** untouched (mrp stays whatever it was).
- **Renderers:** inventory/storefront already guard on `mrp > price`, so a missing
  or too-low MRP simply shows no strike-through — no new UI states.
- **Excel back-compat:** older sheets without the MRP column still import (optional).
- **Column order:** `insertProducts` INSERT column list + placeholders were
  re-numbered together when inserting `mrp` — verified param mapping.

## Related
Completes the drill-down add/edit form fields alongside
[[listing-product-description]] and [[listing-product-edit]].
