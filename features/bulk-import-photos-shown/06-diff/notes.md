# Before / after
- Before: INSERT RETURNING omitted image_url; needs_photos = ALL created; tray
  said "needs photos" despite ingested photos. splitUrls comma-only; colour
  images accumulated with no dedup (12/colour).
- After: RETURNING image_url + JS photo_count; needs_photos = photo-less only;
  splitUrls comma|newline + intra-cell dedup; colour images deduped across size
  rows. tests/listing-bulk-images.test.js GREEN; pnpm qa GREEN. Backend-only.
