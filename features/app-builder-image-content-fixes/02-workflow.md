# Workflow — app-builder-image-content-fixes

1. Admin → App Builder → Home/fashion → Add section → Full-width banner → My
   images.
2. The step shows "📐 Image size for this design: 1080 × 720 px · 3:2 · JPG/PNG
   under 2 MB".
3. Admin picks a file → "⏳ uploading…" → the tile shows the thumbnail and the
   phone preview shows the banner. (Presigned via the sections endpoint — works
   without the food capability.)
4. If upload fails, a red banner states exactly why (403 / R2 / no URL).
5. Admin leaves the Section name blank → allowed (banner never shows it); a
   hidden label is saved. For a Product shelf / image cards, name stays required.
6. Publish → banner renders on device.
