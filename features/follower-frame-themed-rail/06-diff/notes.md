# Before / after — follower-frame-themed-rail

Additive: a new Frame layout. No backend, no migration. Verified by build/lint +
founder walk; the follower render reuses shipped tile components. Matches mockup
`04-preview/mockups/themed-rail.html` (reviewed live via the visualize tool).

## Admin (`Packages/brand-web/app/admin/sections/page.js`)
- **Before:** Frame Layout = carousel / featured / grid / banner / mosaic; no themed
  scroll rail; no frame-background control; no frame-level tile size.
- **After:** Layout adds **Themed rail (scrollable)**; when selected, a **Frame look**
  panel appears — background **colour** picker + **image** upload (image wins; both
  blank → white shell), **title align** (left/center), **tile size** (Small/Big).
  Writes `config.frame` + `config.tile`. Timer block + per-tile image/label/rule reused.

## Mobile (`Packages/Mobile/src/components/sections/TileSection.js`)
- **Before:** styles carousel/featured/grid/banner/mosaic; timer only as a thin bar.
- **After:** new `ThemedRailStyle` — themed shell (colour, or `<Image>`+scrim, or white
  + border), header (aligned title + **boxed** countdown when `timer` set), horizontal
  `ScrollView` of tiles at `tile.size` (large = portrait hero + label overlay; medium =
  square + label below). `useCountdown` extended to expose `hh/mm/ss` (days rolled into
  hours) for the boxed timer; thin `CountdownBar` (mosaic) unchanged. Text auto-contrasts
  (white on colour/image, ink on white). Dispatcher routes `style==='themed_rail'`;
  its timer renders inside the header (no external bar). Expiry still hides the frame.

## Backend
- None. `config.frame/tile/timer/tiles` ride `sectionEngine` passthrough.

## Verification
- `pnpm qa` GREEN 79 (regression guard).
- Mobile babel-transform clean; `npx jest` 25/25 incl. `TileSection.test.js`
  (FollowerWallet suite = known baseline load-fail, ignored).
- brand-web `sections/page.js` parses clean (@babel/parser, jsx).
