# Before/after — image-crop-uploader (Phase 1)

## Before
Every image (product photo, banner tile) uploaded raw at whatever shape the
brand picked; the phone rendered it in a fixed-aspect box with object-fit cover,
cropping mismatched images unpredictably. No cropping control anywhere.

## After
A shared crop-to-frame modal (dependency-free canvas) sits between file-pick and
upload:
- Photo auto-centred to cover the surface's exact frame; one tap confirms.
- Drag to reposition, zoom slider (1–3x) to scale; pan clamped to keep the frame
  covered.
- Exports a JPEG at the surface's target px — WYSIWYG (preview canvas and export
  canvas share the transform).
- Central `lib/imageFrames.js` maps every surface → aspect/size.
- Wired into App Builder banner/tile uploads (crop at the design's frame) and
  dashboard product photos (cover + variant, crop 4:5, multi-file queue).
- Existing presign/gallery upload transport unchanged — just receives the
  cropped file.

## Verification
- brand-web `next build` ✓ compiled (admin/sections + products/listing).
- Crop math WYSIWYG by construction (export scale = targetW/FRAME_W; frame height
  derived from aspect so preview==export).
- `pnpm qa` GREEN (79).
- Founder eyeball on first upload is the visual confirmation (can't render canvas
  headless here).

## Deploy
brand-web (Vercel) only. No backend, no OTA. Category image upload = Phase 2.
