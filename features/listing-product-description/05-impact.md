# Impact

**Chat verdict:** additive, optional field. Closes a data-entry gap; no migration,
no controller change, no behaviour change for existing products or other verticals.

## Surface area
### Frontend (UI-governed)
- `Packages/brand-web/app/dashboard/products/listing/page.js` — Description textarea
  on the Basics step; `description` added to `blankDraft` + the batch item; shown on
  Review. Textarea CSS added to the scoped `.lst` stylesheet.

### Backend (governed, additive)
- `backend/src/services/listingBulk.service.js` — `Description` column added to the
  generated template (`columnModel`) and read back in `buildItems`.
- No controller change: `insertProducts` already writes `it.description || null`.

## Blast radius / risk
- **Required validation:** unchanged — description is optional, so no new blocking.
- **Existing products:** untouched (still `null` until edited via the future edit
  surface).
- **Bulk template:** adding an optional column is backward-compatible; older filled
  sheets without the column still import (column is not required).
- **Other verticals:** don't use this add flow — unaffected.

## Related
- The ability to EDIT description (and photos / facets) after listing is a separate
  follow-up (fashion edit surface). This contract only adds description at CREATE.
