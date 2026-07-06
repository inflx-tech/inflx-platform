# Before / after — product image resolution

## Read surfaces
- **Before:** brand listing browse (getNodeProducts raw rows; mapBrowseProduct)
  and follower section-engine (mapListedProductItem) returned `image_url`
  verbatim; the edit form fell back to variant/facet images. → product with a
  never-derived cover: blank on listing + follower, photo on edit, "fixed" only
  by a re-save (which derives image_url via coverImage).
- **After:** all three reads use `resolveProductImage()` — the same fallback the
  edit form uses. The two follower product SELECTs (productsInCategory,
  library_products) now also select variants_json + facets. Explicit image_url
  still wins (byte-identical for image-set products).

## Create side
- **Before:** brand.controller createProduct stored `image_url || null`
  verbatim (no derivation) — unlike the listing wizard which derives via
  coverImage. A generic create with images only in variants → null cover.
- **After:** `image_url || resolveProductImage({image_url, variants_json}) || null`.

## Backfill
- New `scripts/backfill-product-image-url.js` — dry-run default, --commit /
  --staging, only writes null rows, never overwrites. Prod dry-run: 72 empty /
  0 fixable (photo-less seeds) — no prod repair needed today.

## Evidence / honesty
- Ruled out URL-format theory: stored URLs absolute; /v1/media/assets/:id
  302-redirects to a fresh 1h presigned R2 URL (browser + RN follow it).
- Could NOT reproduce a live broken row in prod (0 today — already re-saved;
  staging paused). "Edit shows the image" proves images persist → read
  asymmetry is definitionally the cause; the read resolver removes it.
- productImage.test.js 8/8; section-engine = 3 ledgered pre-existing only;
  pnpm qa GREEN gate 0 (report 2026-07-06T12-52-16).
