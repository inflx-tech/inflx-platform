# Expected Outputs — follower-category-subcat-circles

## Files
- `Packages/Mobile/src/components/vibe/CategoryCircle.js` — additive `active` prop.
- `Packages/Mobile/src/screens/follower/CategoryListScreen.js` — sub-cat bar as a
  round-circle carousel.

## Acceptance checks
1. Category sub-cat bar renders as round circles (icon tile + label), not pills.
2. Active sub-type highlighted (brown tile + brown label).
3. Tapping a circle filters the brand/product shelves; "All" clears.
4. Circles reflect real sub-types only; bar hidden when none.
5. `CategoryCircle` `active` is additive → Home/other unaffected.
6. Babel transform PASS; `pnpm qa` GREEN.

## Release classification
- **production-impacting** (follower OTA — Category). Surfaced for founder go;
  `released` true only after go + Maestro attest (or recorded override). OTA:
  `pnpm publish-ota:follower` (follower OTA v70 → next).
