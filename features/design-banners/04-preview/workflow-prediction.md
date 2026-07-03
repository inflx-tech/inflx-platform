# Workflow prediction — design-banners (P3b)

Mockup: `04-preview/mockups/00-banner-pack.html` (combined follower view of the
four additions — announcement strip, split banner, full-width image fill,
collage slot layouts).

Predicted runtime behavior after implementation:
- Backend: three enum words added — strip/split/fullbleed rows validate; no
  payload/engine change.
- Admin: two greyed cards (announcement_strip, split_banner) become selectable;
  full_width_banner Content step gains an image-fill tab; collage images editor
  gains a slot-layout picker. Everything else in the wizard reused as-is.
- Mobile: three new TileSection style branches + slot_template handling in
  MosaicStyle. Devices WITHOUT the OTA render the new styles via the default
  carousel branch (graceful). Existing collage rows (no slot_template) render
  exactly as today.
- Scheduling / countdown / per-tile actions compose for free (P1 + P2).
- Ships on the SAME held mobile OTA as P3a — one Maestro run verifies both.
