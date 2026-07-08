# Before/after — app-builder-image-content-fixes

## Before
- App Builder image upload called the FOOD master-dishes presign
  (`/admin/master-dishes/stock-upload-url`, capability `master_data`). App
  Builder itself needs capability `sections`. A sections-admin without the food
  capability → silent 403 → image never uploaded → tile + phone preview blank.
- Section name force-required even for banner designs that never display it.
- Image size hints were sparse/inconsistent.

## After
- New `POST /admin/sections/stock-upload-url` (capability `sections`) reuses the
  same R2 transport + permanent `/v1/media/stock/*` public URL. App Builder
  uploads through it (`uploadAdminStockImage(file, sectionApi.stockUploadUrl)`).
- Upload errors surface in the wizard (red banner) + an "⏳ uploading…"
  indicator — never silent again.
- Name optional for full_width_banner / hero_slider / announcement_strip /
  split_banner / filter_chips (blank → auto-filled hidden label); other designs
  keep the required title.
- My-images step shows a per-design spec box: exact px size + aspect + JPG/PNG
  under 2 MB.

## Verification
- Backend routes load; presign handler reuses mediaService. Media serve route
  confirmed public (no auth) so `<img>` loads.
- brand-web `next build` ✓; `pnpm qa` GREEN (79).
- On-device/prod after-capture owed on the founder's next upload attempt — this
  is the real test of the capability fix against prod R2.

## Deploy
Render (backend) + Vercel (brand-web) on push. No mobile, no OTA.
