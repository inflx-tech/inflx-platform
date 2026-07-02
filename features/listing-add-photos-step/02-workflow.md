# Workflow — Photos with variants

## Add — product WITH colours
1. Step 1 (Basics): name, brand, price, MRP, stock, SKU, description. No photos.
   Next enabled once name + price are set.
2. Step 2 (Variants): pick colours + sizes → per-colour photo uploaders + per-size
   stock appear. Upload at least one photo (any colour). Next enabled once required
   variant facets are chosen AND ≥1 photo exists.
3. Step 3 (Details) → Step 4 (Review). Review shows the first available photo
   (cover, else first colour's first photo).
4. Save → main `image_url` = first colour photo (via `coverImage` fallback).

## Add — product with NO colour variant (e.g. free-size, furniture by seater)
1. Step 1 (Basics): same info fields, no photos.
2. Step 2 (label "Photos" / "Variants"): shows a single **Product photos** uploader
   (no colour cards). Upload ≥1 photo.
3. Steps 3–4 as above. Main image = first product photo.

## Edit
- Same restructured form. An existing product loads its photos (per-colour and/or
  legacy cover) and its fields; the brand edits and saves.
- Legacy cover images on old products are preserved on save even though they're no
  longer surfaced as a separate Step-1 field.

## Validation
- Step 1 blocks only on missing name / price.
- Step 2 blocks on missing required variant facet OR zero photos ("at least one
  photo").
- Final save (`draftErrors`) also requires ≥1 photo — a belt-and-braces guard.
