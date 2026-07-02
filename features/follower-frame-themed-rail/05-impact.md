# Impact — follower-frame-themed-rail

**Verdict:** additive — a new Frame layout value. Existing styles untouched; no
backend, no migration.

## Surface
- **Admin brand-web `app/**` (Vercel):** `sections/page.js` — new `themed_rail`
  layout option + a Frame panel (bg color/image, title align, tile size). Reuses the
  existing image uploader, timer block, and per-tile rule editor.
- **Mobile `src/**` (OTA, no APK):** `components/sections/TileSection.js` — new
  `ThemedRailStyle` + boxed-countdown; `useCountdown` extended to expose dd/hh/mm/ss.
  Dispatcher routes `style==='themed_rail'`. Other styles + the thin `CountdownBar`
  (mosaic) unchanged.
- **Backend:** none — `config_json` flows through `sectionEngine`.

## Risk register
- **Regression:** low. New code gated on `style==='themed_rail'`; default paths
  untouched. Gates: `pnpm qa` GREEN 79 + jest 25/25 (incl. `TileSection.test.js`).
- **Legibility on image bg:** dark scrim + white text (same technique as the shipped
  `banner`/`mosaic` label overlays).
- **Layout:** horizontal `ScrollView` of fixed-width tiles → no wrap/overflow math.
- **Timer:** reuses the shipped `useCountdown`; blank/invalid → no timer; expiry hides.

## Deploy classification
Production-impacting (Vercel admin + mobile OTA). No migration/backend. Ships admin +
mobile together → founder walk. `release.released` false.
