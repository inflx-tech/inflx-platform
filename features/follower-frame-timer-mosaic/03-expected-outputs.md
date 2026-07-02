# Expected outputs — follower-frame-timer-mosaic

## Admin (brand-web)
- Frame Layout dropdown includes **"Mosaic (mixed-size tiles)"**.
- In mosaic mode each banner/tile row shows a **Size: Small / Large** toggle → writes
  `tiles[i].size`.
- A **"⏳ Countdown timer (optional)"** block (datetime + label + clear) writes
  `config_json.timer = { ends_at, label }`; clear removes it.
- `TemplatePreview` shows a mosaic wireframe (one large + two small) when style=mosaic.
- Publish persists `style`, `timer`, and per-tile `size`; existing frames unaffected.

## Mobile (OTA, no APK)
- `config.style==='mosaic'` → tiles in a mixed-size grid (large full-width hero,
  small 2-up); tap → the tile's rule grid (unchanged).
- `config.timer.ends_at` in the future → countdown bar "⏳ {label} HH:MM:SS"
  (`Dd HH:MM:SS` when >24h) ticking each second above the frame.
- Countdown reaches zero → the frame renders nothing.
- No timer + non-mosaic style → byte-identical to today.
- babel-check passes on changed files; `npx jest` 25/25 (FollowerWallet baseline ignored),
  incl. the existing `TileSection.test.js` still green.

## Backend
- None. `config_json` (style/timer/tiles[].size) passes through `sectionEngine`
  unchanged. `pnpm qa` GREEN 79 (regression guard only).

## Acceptance (founder walk)
- Compose a fashion Home frame: Layout=Mosaic, 1 Large + 2 Small tiles with images +
  rules, timer set ~1h out. Publish.
- Follower app (relaunch for OTA): the frame shows the mosaic + a live ticking timer;
  tapping the large tile opens its product grid. Setting the timer to a past time (or
  waiting) hides the frame.
