# Expected outputs — Listing Bulk Add via Excel

## Backend
- `GET /listing/nodes/:id/template.xlsx` → 200, `Content-Type:
  …spreadsheetml.sheet`, `Content-Disposition: attachment; filename="<leaf>-
  template.xlsx"`. Sheet "Products" (header from current facets, dropdowns,
  required marked, row-per-variant cols) + sheet "Instructions" (help +
  spec-date stamp). Leaf-only (422 otherwise).
- `POST /listing/nodes/:id/import` (brand auth, multipart `file`) → 201
  `{created_count, products[], needs_photos[]}` on success; 422 with
  `error.field = {row_errors|file_errors}` on validation failure (nothing
  saved). Unauth → 401. >200 grouped items → 422.

## Brand-web (`/dashboard/products/listing` leaf)
- Tabs: **Add one-by-one** (stepper) / **Bulk add (Excel)**.
- Bulk: Download template (link) · Upload (.xlsx/.csv) · per-row error report ·
  success + **Add photos** tray (per-product cover upload → `updateProduct`).

## Invariants
- Import items pass through the same `validateItem` + `insertProducts` as the
  UI batch — identical rules, SKUs, rows.
- Template + import both read live `facet_definitions` (auto-update).
- No DB/schema/migration; no new deps.

## Proof (recorded)
- `scripts/test-listing-bulk.js` 14/14.
- Live template 200 (valid xlsx, real facets); import 401 unauth.
- `next build` compiled (8.67 kB); `pnpm qa` 79/79 GREEN.
