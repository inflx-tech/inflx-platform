# Before / after — Listing Bulk Add via Excel

**Before:** the only way to add fashion/furniture products was one at a time
(the stepper / the old single panel). A brand with a big catalogue had no bulk
path, and there was no offline workflow.

**After (per 04-preview/mockups/excel-bulk.html, founder-locked):** a second
entry mode at the leaf — **Bulk add (Excel)**:
- **Download template** (`GET /listing/nodes/:id/template.xlsx`) — generated
  **live** from the leaf's current `facet_definitions`: columns = the leaf's
  specs (+ Colour/Size/Variant-stock for row-per-variant), dropdowns on
  enumerated specs, required marked, an Instructions sheet stamped with the
  spec date. SKU omitted (auto).
- **Upload filled file** (`POST /listing/nodes/:id/import`, multer) — parsed
  (xlsx/csv), grouped **row-per-variant** by Name, validated against the
  **current** specs with the same `taxonomy.validateItem` the UI uses, then
  created via the same `insertProducts` path. **All-or-nothing**: any bad row
  → nothing saved + a per-product fix list. A now-required column missing →
  "template out of date — re-download".
- **Post-import photo tray** — the created products listed with **＋ Add
  photos** (uploads a cover, PATCHes the product).

**Auto-update:** because the template AND the import both read
`facet_definitions` live, changing a leaf's specs updates the wizard, the
template, and the importer together — the founder's explicit requirement.

**Unchanged on purpose:** `batchCreate` (refactored to share `insertProducts`
with import — same SQL, same SKUs), `validateItem`, the tree, the stepper.
No DB/schema/migration. `exceljs`/`csv-parse`/`multer` already in deps.

**Verification:**
- `scripts/test-listing-bulk.js` — **14/14** (template columns, parse,
  row-per-variant grouping, multi-select split, validateItem pass,
  stale-column → file error, bad-value → row error).
- Live: `GET …/template.xlsx` → 200, valid xlsx (T-Shirt leaf, 10.5 KB from
  real facets); `POST …/import` unauth → 401 (route gated).
- `next build` compiled (page 8.67 kB); `pnpm qa` **79/79 GREEN** (one earlier
  run showed 5 `ECONNRESET` from a stray dev backend on :3001 — environment
  contention, not a regression; clean re-run GREEN).

**Capture note:** before = the locked mockup; after = founder walk of the
bulk panel (download → fill → upload → photo tray) on a fashion + furniture
leaf — the release gate. The xlsx round-trip is the automated proof.
