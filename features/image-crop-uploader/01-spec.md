# image-crop-uploader — crop-to-frame uploader (Phase 1: products + banners)

## Founder decision (2026-07-08)
Chose crop-to-frame (auto-centred) over padding / paid server-crop. Build the
shared uploader for product photos and banners first.

## Model
Every image renders on the phone in a FIXED-aspect box with object-fit cover
(crops overflow). Now, at upload time, a shared modal shows the photo inside
that exact frame, AUTO-CENTRED to cover it. The admin/brand only drags/zooms
when the auto-fit clipped something; otherwise one tap ("Use this crop"). The
CROPPED JPEG (at the surface's target px) is what uploads — so the phone never
crops unexpectedly. WYSIWYG: the preview canvas and export canvas use the same
transform.

## Scope (Phase 1, brand-web only — no backend, no OTA)
- `components/ImageCropModal.js` — dependency-free canvas cropper (auto-centre,
  drag, zoom slider, JPEG export at target size).
- `lib/imageFrames.js` — central registry: surface → {aspect, w, h, label}
  (single source of truth, mirrors encyclopedia §7).
- Wire into App Builder banner/tile uploads (admin/sections `upload()` → crop at
  the design's frame → existing section presign upload).
- Wire into product photos (dashboard listing cover + per-colour variant inputs
  → crop each at 4:5 → existing gallery upload). Multiple files queue through
  the modal one at a time.

## Non-goals (later phases)
- Category image upload (Phase 2).
- Cloudflare resize-on-read / thumbnails (optional Phase 3).
- Excel-import images, post-import tray photos, gallery picker.

## Acceptance
Picking a banner image opens the crop modal at that design's aspect; the cropped
image uploads and previews. Picking product photos crops each at 4:5. Existing
upload/presign paths unchanged. `pnpm qa` GREEN; brand-web builds.
