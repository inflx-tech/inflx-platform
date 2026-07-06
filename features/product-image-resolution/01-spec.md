# Product image resolution — listing/follower blank while edit shows it

**Reported by founder 2026-07-06:** fresh login → product listing shows no
image; opening Edit shows the image; clicking Save again then makes the listing
show it; the follower app never shows it.

## Root cause (code + prod-DB + live-endpoint verified)

A product's image lives in TWO representations:
- `image_url` (text) — a DERIVED single "cover", set only when a save runs
  `coverImage()` (listing.controller batchCreate/insertProducts + PATCH).
- The real uploads: `variants_json.colors[].images[]` (per-colour),
  `variants_json.cover_images[]`, `facets._images[]`.

The EDIT form falls back through the variant/facet sources
(brand-web listing/page.js:289), so it shows the photo even when `image_url`
is null. The LISTING browse and the FOLLOWER app read `image_url` ONLY, raw
(listing.controller getNodeProducts / mapBrowseProduct:404; sectionRules
mapListedProductItem:686; mobile ProductCard `<Image uri=image_url>`), with an
`onError→hide` on the web img. So a product whose cover was never derived shows
blank on listing + follower, a photo on edit, and "fixes" on re-save (which
derives image_url). That asymmetry IS the bug.

Verified NOT the cause: URL format (stored URLs are absolute
`.../v1/media/assets/:id`, which 302-redirects to a fresh 1-hour presigned R2
URL that browsers + RN both follow — food products render fine).

Prod snapshot: 0 rows currently in the broken state (founder already re-saved
tested products; remaining null-image rows are genuinely photo-less seeds);
staging paused/unreachable at fix time. "Edit shows the image" is the proof the
images persist — this is purely a read asymmetry.

## Fix (backend-only, no OTA)

1. `backend/src/utils/productImage.js` — `resolveProductImage(row)` =
   image_url || variants_json.cover_images[0] || first colors[].images ||
   facets._images[0]. Pure, tolerant of jsonb-as-string and malformed input.
2. Applied at every product READ so all surfaces resolve the cover the SAME
   rich way the edit form does: listing.controller getNodeProducts +
   mapBrowseProduct; sectionRules productsInCategory + libraryProducts
   (added variants_json + facets to their SELECTs) via mapListedProductItem.
3. Create-side belt-and-braces: brand.controller createProduct derives
   image_url from variants when absent (parity with the listing wizard;
   the listing wizard batchCreate already derived it).
4. Backfill script `scripts/backfill-product-image-url.js` (dry-run default,
   --commit / --staging) to keep image_url authoritative and repair history.

## Out of scope
No mobile change (follower reads the backend-resolved image_url — OTA not
needed). Consolidating the two representations into one is a larger refactor,
deferred; the read resolver makes it non-urgent.
