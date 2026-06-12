# Listing Bulk Add via Excel (fashion + furniture)

> Contract slug: `listing-excel-bulk`. A second entry mode at the leaf —
> download a per-leaf Excel template, fill offline, re-upload. Follows the
> stepper (`listing-add-stepper`, shipped). Decisions locked 2026-06-12:
> **blank template (current specs)**, **row-per-variant**, **post-import
> photo tray**. See [[project-listing-add-redesign]].

## Core principle — single source of truth = auto-update
The template is **generated live** from `facet_definitions` at download time
(never a stored file). The **same** table drives the stepper wizard, the
template, and the import validation. So when a leaf's specs change (a facet
added/removed/renamed), all three reflect it automatically — no template
maintenance. This is the founder's explicit requirement ("change a spec →
the sheet auto-updates").

## Backend

### GET `/listing/nodes/:id/template.xlsx`  (public read, like getNodeFacets)
Live-generate an `.xlsx` (exceljs) for one leaf:
- **Sheet "Products"** — header row built from the leaf's current facets:
  `Name* · Price* · Brand · Stock` + one column per facet (label), then the
  variant columns `Colour* · Size · Variant stock` (row-per-variant model).
  - Enumerated facets (single/multi_select with >1 `allowed_values`, and
    `size` via the leaf's `size_system`) get **dropdown data-validation** so
    cells only accept valid values.
  - Required columns marked (`*` + header fill). SKU omitted (auto).
  - One greyed **example row**.
- **Sheet "Instructions"** — per-column help + allowed values; a **stamp**:
  leaf id + `category_node_id` + "specs as of <date>" (passed in, since
  `new Date()` is fine in a request handler) so a stale file is detectable.
- Filename: `<leaf-name>-template.xlsx`.

### POST `/listing/nodes/:id/import`  (auth brand; multer single file)
Parse → build items → validate → create:
1. Parse the uploaded `.xlsx`/`.csv` (exceljs / csv-parse).
2. **Group row-per-variant** by product Name (+ identical non-variant facets):
   each group → one item; its rows' `Colour/Size/Variant stock` fold into
   `variants:[{color, images:[], sizes:[{size, stock}]}]` and
   `facets.color_tone=[…] facets.size=[…]`; descriptive/discovery columns →
   `facets`.
3. **Validate each item against CURRENT specs** via `taxonomy.validateItem`
   (the same function the UI + batch use):
   - removed/unknown columns → **ignored** (tolerant).
   - a now-**required** column missing for all rows → file-level error
     *"template out of date — re-download"* (never save incomplete).
   - per-row errors returned as a list (row N: Fabric invalid…).
4. **All-or-nothing** (founder, 2026-06-12): if any row is invalid, save
   nothing and return the full fix-list — same semantics as today's batch-add.
   All valid → **`batchCreate`** (reused verbatim; ≤200 items). Photos empty.
   Returns created count + SKUs + the new product ids (for the photo tray).

No new validation rules, no DB/schema change, no migration. `exceljs`,
`csv-parse`, `multer` already in backend deps.

## Brand-web (at the leaf)
- A mode toggle: **Add one-by-one** (the stepper) vs **Bulk add (Excel)**.
- Bulk panel: **Download template** · **Upload filled file** · a clear
  **per-row error report** on failure · success summary (N created + SKUs).
- **Post-import photo tray**: the just-created products listed with a per-
  product cover-photo upload (and per-colour where variants exist), so the
  spec-only imports get pictures in a quick pass. Reuses the existing upload +
  a product-image update.

## Non-goals
- Pre-filling existing products for bulk-EDIT (founder chose blank add-only).
- A self-serve admin "spec editor" (specs still change via facet_definitions
  seed/migration; auto-update works regardless).
- Restaurant/other verticals (drill-down verticals only: fashion + furniture).

## Verification
`pnpm qa` GREEN; a backend test: generate a leaf template → fill rows
(incl. a 2-colour row-per-variant product) → import → assert products +
variant matrix created and a stale/invalid file is rejected with a clear
report; founder mockup-lock; 06-diff before deploy.
