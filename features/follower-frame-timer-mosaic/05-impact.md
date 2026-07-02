# Impact — follower-frame-timer-mosaic

**Verdict:** purely additive to the Frame tool; a frame with no timer and a
non-mosaic style is byte-identical to today. No backend, no migration.

## Surface
- **Admin brand-web `app/**` (Vercel):** `sections/page.js` gains a `mosaic` layout
  option, a per-tile Size toggle (mosaic only), a Countdown-timer block, and a mosaic
  `TemplatePreview` branch. Existing frame styles/editing untouched.
- **Mobile `src/**` (OTA, no APK):** `components/sections/TileSection.js` gains a
  `MosaicStyle` renderer + a `useCountdown` hook + a `CountdownBar`; the dispatcher
  routes `style==='mosaic'` and (any style) wraps with the countdown when set. Other
  styles unchanged.
- **Backend:** none — `config_json` already flows through `sectionEngine`.

## Risk register
- **Regression:** low. New code is gated on `style==='mosaic'` / `config.timer`
  presence; default paths untouched. `pnpm qa` GREEN 79 + jest 25/25 (incl.
  TileSection test) are the gates.
- **Timer correctness:** client-side `useCountdown` on a 1s interval; parses
  `ends_at` via `new Date()`. Blank/invalid → no timer (safe). Expired → frame hidden;
  no data gate bypassed (rule still returns items — timer is display-only urgency).
- **Layout overflow:** mosaic uses percentage cells (50%/100%) with padding gutters
  (same pattern as the existing grid style) → no gap-overflow.

## Deploy classification
Production-impacting (Vercel admin + mobile OTA). No migration, no backend.
Step-gated: admin+mobile ship together → founder walk. `release.released` false.
