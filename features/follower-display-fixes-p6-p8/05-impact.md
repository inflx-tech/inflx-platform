# Impact — P6/P8 display fixes

**Chat verdict (terse):** two render-only bug fixes on existing locked follower
screens. Mobile OTA only; no backend/DB/migration/data-shape change; zero
functional disturbance.

## Surface
- `SectionRenderer.js` — `chipLabel()` normaliser in `ChipRow`.
- `CategoryListScreen.js` — `placeCount` derived from sections in engine mode.

## Risk
- **Very low.** Pure display normalisation with safe fallbacks (empties dropped;
  count falls back to `stores.length`).

## Backout
- Revert the two files; OTA prior bundle.
