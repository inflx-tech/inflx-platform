# Before / After — follower-location-distance-mobile (Contract 2)

## What shipped (8 mobile files, OTA)
- `vibe/palette.js` — `fmtDistance(km)` → "X km away" / "N m away".
- `vibe/ShelfBrandCard` / `ShelfProductCard` / `ShelfBrandListRow` — render a
  distance line when `distanceKm` is present (additive prop).
- `SectionRenderer` — passes `item.distance_km` to those cards.
- `CategoryListScreen` — sends device/selected coords to `getCategorySections`
  (Home already did) so Category also distance-ranks.
- `HomeScreenV2` — posts location (logged-in) → shows the reverse-geocoded area
  name in the header (fallback "Vijayawada").
- `services/api.js` — `followerApi.updateLocation(lat,lng)`.

## Behaviour
- Brand/product/business-list cards show "📍 X km away" when the backend returned
  `distance_km`; Home + Category both rank nearest-first. Home header shows the
  follower's area.

## Honest divergences
- Distance shows only when present — *Aveen food paradise* (backfilled coords) shows
  a real distance now; other brands show none until their coords are set.
- Coords = selected/default location (Vijayawada) today; **auto device-GPS =
  Contract 3 / next APK**. Rating still omitted (no data). Offer/deal cards have no
  distance yet (offer rules don't compute it).

## Verification
- Babel transform via `module:@react-native/babel-preset`: **8/8 PASS**.
- `pnpm qa`: **GREEN — 79 passed, C1 GREEN** (`qa/reports/2026-06-08T11-33-43-600Z/`).
- Additive card props → other screens unaffected.

## Release
**production-impacting** (follower OTA). Maestro founder-side (recorded override).
