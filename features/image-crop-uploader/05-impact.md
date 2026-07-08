# Impact — image-crop-uploader (Phase 1)

**Verdict: adds a crop step before existing uploads; no backend, no new dep.**

- New shared component (canvas cropper, dependency-free) + a frame registry.
- App Builder + listing route their existing file picks through the modal; the
  upload/presign transport is unchanged (just receives a cropped JPEG instead of
  the raw file).
- No backend, no schema, no OTA. brand-web (Vercel) only.
- Existing images unaffected; only NEW uploads are cropped.
- Risk: canvas crop math — mitigated by WYSIWYG design (preview == export) and a
  build check; founder eyeball on first upload confirms.
- Rollback: revert one commit; uploads go back to raw.
