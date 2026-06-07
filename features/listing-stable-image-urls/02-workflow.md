# Workflow — Stable image URLs

## Upload (write)
1. Seller/admin uploads via GalleryPicker → presigned PUT to R2 → `POST /me/media-assets`
   creates the row → response is `_enrich(row)` with `download_url` = **stable URL**
   (`<base>/v1/media/assets/<id>`).
2. The caller stores that stable URL (e.g. `brand_products.image_url`,
   `brands.listing_data.cover_image_url`, `master_dishes.default_image_url`).

## Display (read)
1. An `<img src="<base>/v1/media/assets/<id>">` (web or mobile) hits the public endpoint.
2. `serveAsset` looks up the asset, re-signs `file_r2_key` (fresh 1-hour URL), `302`
   redirects. The browser follows → image renders. Repeats on every view → never expires.

## Expected end state
- Uploaded images render indefinitely (no 1-hour break). Seeded Unsplash stock URLs
  unaffected (stored directly, not media assets). Private contracts/KYC unreachable via
  this path.

## Verification
- `pnpm qa` GREEN (regression; classify any media-asset test that asserted a raw signed
  download_url as business-rule drift — the URL is now intentionally stable).
- Founder manual: upload an own dish photo → it still shows after >1 hour.
