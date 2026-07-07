# Expected outputs
- tests/listing-bulk-images.test.js GREEN (dedup across size rows; comma+newline split).
- Import response: products carry image_url + photo_count; needs_photos lists
  only photo-less products.
- node --check clean on both files. pnpm qa GREEN gate 0.
- Backend-only; no migration, no OTA. brand-web tray unchanged (already reads
  image_url/photo_count).
