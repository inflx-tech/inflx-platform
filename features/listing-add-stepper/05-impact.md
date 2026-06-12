# Impact — Listing Add stepper

**Chat verdict (terse):** brand-web only, one file, no backend/schema/DB/
migration — a layout + flow restructuring of an already-proven form. The
`batchCreate` contract and `validateItem` rules are untouched, so existing
listing QA stays valid. Net: easier data entry, zero functional change to
what gets saved.

## Surface area
- `Packages/brand-web/app/dashboard/products/listing/page.js` — leaf panel
  becomes a 4-step stepper (state for `step`, partition `facets` by role,
  per-step validation, step nav, carry-over). Drill-down, variant cards,
  upload, and `saveBatch`/`batchCreate` reused as-is.
- Vercel deploy (brand-web). No Render, no OTA, no migration.

## Risk
- **Low.** No data-model or API change; the same item objects reach the same
  endpoint. Main risk is a per-step validation rule drifting from
  `validateItem` — mitigated by mirroring it exactly and a Playwright walk
  that stages + saves a real item.

## Backout
- Revert the single file; brand-web redeploys the prior page. No data to unwind.
