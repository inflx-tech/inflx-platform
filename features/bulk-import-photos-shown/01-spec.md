# Bulk import — show "photo added" when Excel URLs were ingested

**Founder 2026-07-06:** bulk-uploaded Polo products with image URLs in the
Excel; the import succeeded and ingested the images (verified in prod:
CHAR-0018/19/20 all have image_url + per-colour images), but the post-import
tray still says "needs photos" for every product.

## Root cause
The bulk INSERT `RETURNING` clause omitted `image_url`, and the response set
`needs_photos = created.map(id)` unconditionally. So the browser never learned
the products already had photos → the tray showed "needs photos" for all. The
photos were safely stored; the screen was wrong.

Secondary: the same URLs repeated across a colour's size rows were accumulated
without dedup → 12 images/colour (3 URLs × 4 sizes) instead of 3.

## Fix (backend only — no OTA)
- `insertProducts`: `RETURNING ... image_url`; attach `photo_count` (unique
  cover + colour images) to each created product.
- `importProducts`: `needs_photos = created.filter(p => !p.image_url)` — only
  products with NO photo.
- `listingBulk.splitUrls`: split on comma OR newline + dedup within a cell;
  dedup a colour's URLs across its size rows.

The brand-web tray already renders `image_url` + `photo_count` ("photo added" /
"＋ More photos") — it just wasn't receiving them.

## Out of scope
Follower-side rendering (already correct — these products show in the app).
