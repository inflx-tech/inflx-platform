# Expected outputs — image-crop-uploader (Phase 1)

1. `components/ImageCropModal.js` — auto-centre + drag + zoom + JPEG export at
   target px; preview canvas == export transform.
2. `lib/imageFrames.js` — surface→frame registry.
3. admin/sections: `upload()` opens the crop modal at the design's frame; cropped
   file uploads via the section presign.
4. dashboard listing: cover + variant photo inputs queue through the crop modal
   at 4:5; cropped files upload to the gallery.
5. brand-web builds; `pnpm qa` GREEN.
