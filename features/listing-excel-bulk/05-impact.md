# Impact — Listing Bulk Add via Excel

**Chat verdict (terse):** additive — a new bulk entry mode beside the stepper.
Reuses `validateItem` + `batchCreate` verbatim (no new rules), uses the
already-installed `exceljs`/`csv-parse`/`multer`. No DB/schema/migration. The
live-from-`facet_definitions` generation is what makes specs auto-propagate to
the sheet, exactly as required.

## Surface area
- **Backend** — 2 new endpoints in the listing controller/routes (template
  generate, import). New deps: none. Touches no existing endpoint.
  Production-impacting (Render) → explicit go.
- **Brand-web** — a bulk panel + post-import photo tray at the leaf
  (`products/listing/page.js` or a sibling component). UI-governed →
  mockup-lock + 06-diff. Vercel.

## Risk
- **Low–moderate.** Parsing/grouping is the new logic; bounded by reusing
  `validateItem` (so a bad import can never write invalid data — same gate as
  the UI) and the ≤200 cap. Multipart upload via multer (memory storage, size
  limit). No money path, no attribution path.

## Backout
- Remove the 2 routes + the bulk panel; revert. No data migration to unwind
  (imported products are ordinary `brand_products` rows).
