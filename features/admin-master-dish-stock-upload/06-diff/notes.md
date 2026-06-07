# Before/After — Admin stock-image upload

Mockup locked: `04-preview/mockups/01-admin-stock-upload.html`.

## What shipped (matches the mockup)
- Admin master-dishes edit modal: "Default image URL" field → **"Stock image"** with a
  **thumbnail preview** + **"⬆ Upload stock image"** button. Uploading sets
  `default_image_url` to a permanent `/v1/media/stock/...` URL; **paste-URL fallback kept**.
- Backend: `mediaService.generateStockUploadUrl` (presigned PUT, `stock/dishes/...` key);
  `POST /admin/master-dishes/stock-upload-url` (reviewer) returns presigned URL +
  `public_url`; public prefix-guarded `GET /v1/media/stock/*` (re-sign + 302, `stock/` only).
- `lib/api.js`: `adminApi.stockUploadUrl` + `uploadAdminStockImage(file)` (mirrors the gallery
  PUT/mock transport; returns the permanent URL, no DB row).

## Honest divergences
- Stock images are NOT brand_media_assets (they're platform-owned), so they have no gallery
  row — they're referenced directly by `master_dishes.default_image_url`. The serve route is
  prefix-guarded (`stock/`) rather than id-keyed.

## Verification
- `pnpm qa` GREEN (web/api/unit). Founder manual: edit a dish → upload → save → image shows
  in the admin table + seller picker, and persists past an hour.
