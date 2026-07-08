# Before/after — banner-swipe-category-tap

## Before
- Full-width banner with 3 images → only image #1 shown; no swipe
  (FullBleedStyle used tiles[0]).
- Banner tap → category opened a grid of category TILES (CategoryBrowser
  isAllMode) instead of the left-rail + product-grid browser — because the phone
  read `tap_destination.node_id` while the admin stored `category_node_id`, so
  nodeId was always null.

## After
- FullBleedStyle: one image = static banner (byte-unchanged); multiple = manual
  swipeable carousel + dots (no auto-advance — Hero slider keeps that).
- SectionRenderer reads `category_node_id || node_id` at both the section-level
  (:250) and per-tile (:296) category taps → CategoryBrowser opens at the picked
  node → left rail of subcategories + right product grid.
- brand-web hint tells admins a Full-width banner takes one (static) or several
  (swipeable) images.

## Verification
- Both mobile files babel-parse clean; TileSection jest 6/6 pass.
- brand-web `next build` ✓; `pnpm qa` GREEN (79).
- On-device after-capture owed on the OTA: swipe the 3 banners; tap → rail+grid
  browser at the chosen category.

## Deploy
Mobile OTA (both renderer fixes) + Vercel (brand-web hint). No backend.
