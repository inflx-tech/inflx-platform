# Workflow — Listing Bulk Add via Excel

## Happy path
1. Brand drills to a leaf (e.g. Saree) → picks **Bulk add (Excel)**.
2. **Download template** → `GET /listing/nodes/:id/template.xlsx`. Opens in
   Excel/Sheets with the leaf's columns, dropdowns on enumerated specs, an
   example row, and an Instructions sheet stamped with the spec date.
3. Brand fills rows offline. A 3-colour saree in 2 sizes = up to 6 rows
   (same Name + Price + specs, differing Colour/Size/Variant stock).
4. **Upload filled file** → `POST /listing/nodes/:id/import`.
5. Server parses → groups row-per-variant by Name → validates each item
   against current specs → `batchCreate`. Returns "N products created" + SKUs.
6. **Photo tray** appears: each created product with an **Add photos** button
   (cover; per-colour where it has colours). Brand adds pics → done.

## Spec-change auto-update (the key requirement)
- Founder changes a leaf's specs (facet added/removed) in `facet_definitions`.
- Next **template download** reflects it immediately (live-generated).
- **Import** validates against the new specs: removed columns ignored; a new
  required column missing → "re-download" error.
- The stepper wizard reflects the same change. One source, three surfaces.

## Edge cases
- **Stale template** (downloaded before a spec change): tolerated when the
  change is additive-optional or a removal; blocked with a clear re-download
  message only when a now-required column is absent.
- **Invalid dropdown value** (hand-typed) → per-row error, whole file rejected
  (all-or-nothing, like batchCreate today).
- **>200 rows** → reject with "split into batches of 200".
- **Empty/duplicate Name** → row error.
- **CSV upload** (brand exported to CSV) → accepted via csv-parse.
