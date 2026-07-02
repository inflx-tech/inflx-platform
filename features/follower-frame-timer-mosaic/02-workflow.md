# Workflow — follower-frame-timer-mosaic

## Admin: build a timer + mosaic frame
1. App Builder → pick scope + world (e.g. Home · fashion) → **＋ Add Section →
   Image / banner frame**.
2. Expand the frame's config editor → **Layout → "Mosaic (mixed-size tiles)"**.
3. **＋ Add banner** for each tile → upload image + label + rule (create/saved).
   For each tile pick **Size: Small / Large** (shown only in mosaic mode).
4. **Countdown timer (optional):** set an end date-time + label (e.g. "Sale ends in").
5. Publish → `PUT /admin/sections/:screen` stores `config_json.style='mosaic'`,
   `config_json.timer`, and per-tile `size`.

## Follower: render (runtime)
1. Section arrives with `config.style='mosaic'` (+ optional `config.timer`).
2. `TileSection`:
   - If `config.timer.ends_at` is in the future → render a countdown bar above the
     tiles, ticking each second.
   - If the countdown has passed → render nothing (the frame disappears).
   - Render tiles in a mosaic grid: `size:'large'` full-width, `size:'small'` 2-up.
3. Tap a tile → its rule's product grid (`SectionResults`), unchanged.

## System / data
- `config_json` (incl. `style`, `timer`, `tiles[].size`) rides the existing
  `sectionEngine.buildSections` passthrough (`config: cfg`) → surfaces as
  `section.config.*` on mobile. No new endpoint, no migration.

## Edge handling
- Malformed/blank `ends_at` → treated as no timer (no bar, frame shows normally).
- Timer with 0 tiles → frame renders nothing (existing empty guard).
- Expired timer → whole frame hidden; the underlying rule/products are untouched.
