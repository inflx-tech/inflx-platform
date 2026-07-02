# Before / after — follower-frame-timer-mosaic

Additive to the Frame tool; no backend, no migration. Verified by build/lint +
founder walk (no Playwright capture — follower render reuses the shipped tile
components). Matches mockups `04-preview/mockups/admin-mosaic-timer.html` +
`follower-mosaic-timer.html`.

## Admin (`Packages/brand-web/app/admin/sections/page.js`)
- **Before:** Frame Layout = carousel / featured / grid / banner; no timer; no per-tile size.
- **After:** Layout adds **Mosaic (mixed-size tiles)**; a **⏳ Countdown timer (optional)**
  block (datetime + label + clear) writes `config_json.timer`; each tile shows a
  **Size: Small / Large** toggle in mosaic mode (`tiles[i].size`); `TemplatePreview`
  gains a mosaic wireframe. Other styles/editing untouched.

## Mobile (`Packages/Mobile/src/components/sections/TileSection.js`)
- **Before:** four style renderers (carousel/featured/grid/banner); no countdown.
- **After:** new `MosaicStyle` (large tile full-width, small 2-up, label scrim) + a
  `useCountdown` hook + `CountdownBar` rendered above any Frame when `config.timer.ends_at`
  is set. Countdown reaching zero returns `null` (frame hidden). Dispatcher routes
  `style==='mosaic'`; carousel/featured/grid/banner unchanged; tile tap unchanged.

## Backend
- None. `config_json` (style/timer/tiles[].size) flows through `sectionEngine` untouched.

## Verification
- `pnpm qa` GREEN 79 (regression guard; backend untouched).
- Mobile babel-transform clean; `npx jest` 25/25 incl. existing `TileSection.test.js`
  (FollowerWallet suite = known baseline load-fail, ignored).
- brand-web `sections/page.js` parses clean (@babel/parser, jsx).
