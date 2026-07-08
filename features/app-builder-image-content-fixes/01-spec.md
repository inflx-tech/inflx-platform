# app-builder-image-content-fixes — fix section image upload + name + size guidance

## Founder (live screenshot, 2026-07-08) — App Builder → Full-width banner → My images
1. Image selected but NOT showing; preview blank (change-program item #4).
2. Name still forced even for a banner (item #3).
3. As a layman, wants clear per-design image size + format guidance.

## Root cause (verified in code)
- The App Builder is gated by capability `sections`
  (adminSections.routes.js:14). But the image presign it used was the FOOD
  master-dishes endpoint `POST /admin/master-dishes/stock-upload-url`, gated by
  `master_data` (admin.routes.js:143). A sections-admin without the food
  capability → silent 403 → image never uploads → tile + preview blank. (The
  page's "Admin access required" text corroborated the capability gap.)
- The media serve route `/media/stock/*` is PUBLIC (index.js:183), so once
  uploaded the `<img>` loads fine — no second bug there.

## Fix
### Backend
- New `POST /admin/sections/stock-upload-url` in adminSections
  (capability `sections`), reusing `mediaService.generateStockUploadUrl` + the
  same permanent `/v1/media/stock/*` public URL. Registered BEFORE `/:screen`.

### brand-web
- `uploadAdminStockImage(file, presignFn)` — optional presign fn; App Builder
  passes `sectionApi.stockUploadUrl` (own capability). Master-dishes callers
  unchanged (default).
- Upload errors now SURFACE in the wizard (red banner) + an "uploading…"
  indicator, so a failure is never silent again.
- Name OPTIONAL for designs that never display it (full_width_banner,
  hero_slider, announcement_strip, split_banner, filter_chips) — blank →
  auto-filled hidden admin label. Other designs keep the required title.
- Per-design image guidance block (exact px size + aspect + JPG/PNG/<2MB) shown
  in the My-images step (IMAGE_SPECS lookup).

## Acceptance
Sections-admin (no food capability) uploads a banner image → it appears in the
tile + phone preview; on failure a clear error shows. Banner name can be left
blank. Each image design shows its size/format. `pnpm qa` GREEN; backend boots.
