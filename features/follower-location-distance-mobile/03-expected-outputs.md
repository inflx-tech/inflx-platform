# Expected Outputs — follower-location-distance-mobile (Contract 2)

## Files
- `Packages/Mobile/src/components/vibe/palette.js` — `fmtDistance`.
- `Packages/Mobile/src/components/vibe/ShelfBrandCard.js` / `ShelfProductCard.js` /
  `ShelfBrandListRow.js` — `distanceKm` render.
- `Packages/Mobile/src/components/SectionRenderer.js` — pass `distance_km`.
- `Packages/Mobile/src/screens/follower/CategoryListScreen.js` — pass coords.
- `Packages/Mobile/src/screens/follower/HomeScreenV2.js` — post location + area name.
- `Packages/Mobile/src/services/api.js` — `updateLocation`.

## Acceptance checks
1. Brand/product/business-list cards show "X km away" when `distance_km` present;
   nothing when absent (no fabrication).
2. Home + Category both rank nearest-first (coords sent on both).
3. Home header shows the reverse-geocoded area for a logged-in follower (fallback
   "Vijayawada"); feed never blocked if the post fails.
4. Card prop additive → other screens unaffected.
5. Babel transform PASS; `pnpm qa` GREEN.

## Release classification
- **production-impacting** (follower OTA). Maestro founder-side (recorded override).
  OTA: `pnpm publish-ota:follower` (v73 → next).
