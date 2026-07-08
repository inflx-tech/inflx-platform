# banner-swipe-category-tap — multi-banner swipe + fix banner→category tap

## Founder (live device, 2026-07-08)
1. Uploaded 3 images to a Full-width banner but can't swipe them — only the
   first shows.
2. Tapping a banner set to open a category shows a grid of category TILES
   (screenshot 2) instead of the expected Blinkit browser — left rail of
   subcategories + right product grid (screenshot 1).

## Root causes (verified in code)
1. `FullBleedStyle` (TileSection.js:144) rendered only `tiles[0]`; the only
   multi-image swipe design was `hero_slider`. So 3 images → 1 shown.
2. **Field-name mismatch:** admin stores the tap target as
   `tap_destination.category_node_id` (admin/sections/page.js:594), but the
   phone read `tap_destination.node_id` (SectionRenderer.js:250 & 296) →
   `nodeId=null` → CategoryBrowser enters "all categories" mode
   (CategoryBrowserScreen.js:88) → the category-tiles grid, not rail+grid.

## Fix
### Mobile (OTA)
- `SectionRenderer.js` (both section-level :250 and per-tile :296) reads
  `category_node_id` (falls back to `node_id`) → CategoryBrowser opens at the
  real node → left rail + product grid, as expected.
- `FullBleedStyle`: 1 image → static banner (unchanged); MULTIPLE images → a
  manual swipeable carousel with dots (no auto-advance — that stays Hero
  slider's distinction).

### brand-web
- Full-width banner image hint updated: "one (static) or several (swipeable
  deck)"; Hero slider still noted for auto-advance.

## Acceptance
A Full-width banner with 3 images swipes on the phone. Tapping a banner set to
a category opens the left-rail + product-grid browser at that category. Old
single-image banners unchanged. `pnpm qa` GREEN; mobile tests pass.
