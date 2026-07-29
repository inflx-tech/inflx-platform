# 02 — Workflow

## W1 — The failure this fixes

1. Brand uploads a full-length garment photo. It is cropped once to
   3:4 (900×1200).
2. Follower opens that brand's store page.
3. **Today:** the tile is 130px tall in a ~48%-width column, so only
   the middle ~54% of the frame survives — the garment renders as a
   torso strip with head and feet cut off.
4. **After:** the tile is 3:4, so the whole uploaded frame shows.

## W2 — Same photo, every surface

Open the same product from each of: brand store, category list, saved,
wishlist, a post's product gallery, and the Shop-this-post sheet.

- **Predicted:** identical framing everywhere. No screen crops tighter
  or looser than the upload.
- **Today:** six different crops of one asset.

## W3 — Placeholders keep pace

Saved, Wishlist and the Shop-this-post sheet all render a plain `View`
when a product has no image.

- **Predicted:** the placeholder occupies the same 3:4 box as a real
  image, so grid rows stay level whether or not photos exist.
- **Risk if missed:** `SavedScreen`'s placeholder uses `flex: 1` and
  would collapse to zero height once its wrapper loses its fixed 150px.
  Explicitly covered.

## W4 — Small thumbnails

Review-order and order-history thumbs shift from 42×52 → 42×56 and
52×64 → 52×69. Barely perceptible; the point is that the crop now
matches every other surface.

Cart is deliberately unchanged — line-item and cross-sell rows keep
their current heights.

## W5 — Product detail hero unchanged

`ProductDetailScreen` still uses `contain`. An image that never went
through the crop must not be sliced on the one screen dedicated to
inspecting it.

## Verification

- `pnpm qa` green (the suite covers web; this change is Mobile-only, so
  it is a no-regression check rather than proof of the visual result).
- Visual proof is the founder's combined brand + follower end-to-end
  pass, per the standing rule. `release.released` stays **false** until
  then, so no Maestro gate applies yet.
- Mobile ships by OTA, not by push — publishing is a separate,
  explicitly-approved step.
