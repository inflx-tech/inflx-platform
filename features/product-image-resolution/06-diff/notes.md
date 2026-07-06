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

## Follow-up (2026-07-06): photos-first ordering
- **Symptom after deploy:** founder still saw no fashion images in the follower
  app. Diagnosed NOT a bug — the 4 photographed products sat at positions
  36–39 of a 43-item "Trending Products" rail, behind ~35 photo-less seed
  products (rail is newest-first; the seeds are newer). Verified via the live
  endpoint + prod query. Food looked fine only because all food dishes have
  photos.
- **Fix:** `HAS_PHOTO_SQL` (image_url OR variant cover/colours OR facets._images)
  leads the ORDER BY in products_in_category + library_products (NOT hand-picked
  — admin order wins). Photographed products now open the shelf; placeholder
  cards sink. Proven on prod data (the 4 T-shirts jump to positions 0–3) and by
  tests/product-photo-order.test.js (url- AND variant-photographed lead a newer
  photo-less item).

## Evidence / honesty
- Ruled out URL-format theory: stored URLs absolute; /v1/media/assets/:id
  302-redirects to a fresh 1h presigned R2 URL (browser + RN follow it).
- Could NOT reproduce a live broken row in prod (0 today — already re-saved;
  staging paused). "Edit shows the image" proves images persist → read
  asymmetry is definitionally the cause; the read resolver removes it.
- productImage.test.js 8/8; section-engine = 3 ledgered pre-existing only;
  pnpm qa GREEN gate 0 (report 2026-07-06T12-52-16).
