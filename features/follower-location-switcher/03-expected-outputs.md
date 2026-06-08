# Expected Outputs — follower-location-switcher

## Files
- `backend/migrations/093_follower_address_coords.sql` + `scripts/run-093.js`
- `backend/src/controllers/follower.controller.js` — createAddress geocode +
  `reverseGeocode` handler
- `backend/src/routes/follower.routes.js` — `GET /follower/reverse-geocode`
- `Packages/Mobile/src/services/api.js` — `reverseGeocode`
- `Packages/Mobile/src/contexts/LocationContext.js` — real GPS + auto-detect
- `Packages/Mobile/src/components/LocationSheet.js` — read lat/lng
- `Packages/Mobile/src/screens/follower/HomeScreenV2.js` + `CategoryListScreen.js`
  — useAppLocation coords + tappable header → LocationSheet

## Acceptance checks
1. Cold start auto-detects current location (GPS on runtime-3 APK) → header area name.
2. Tap header → LocationSheet (current / add / saved). Pick a saved address →
   feed re-fetches nearest to it; "X km away" recomputes.
3. Add address → backend forward-geocodes → stored with lat/lng → selectable.
4. Selection persists; chosen address survives cold start.
5. Degrades to default when GPS/geocode unavailable; feed never blocked.
6. babel/node-check PASS; `pnpm qa` GREEN.

## Release classification
- **production-impacting**: Render backend + migration 093 (founder go) + follower
  OTA (runtime 3). No APK rebuild (GPS native already shipped). Surfaced for go.
