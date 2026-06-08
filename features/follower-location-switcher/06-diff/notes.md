# Before / After — follower-location-switcher

## What shipped
**Backend**
- Migration **093**: `follower_addresses += lat, lng`.
- `createAddress` forward-geocodes the typed address (or uses client-sent coords) →
  stores `lat/lng`.
- `GET /v1/follower/reverse-geocode?lat&lng → {area_name}` (public) for the
  switcher's "current location" label.

**Mobile**
- `LocationContext` is now the single feed-location source: `useCurrentLocation()`
  = real GPS (geolocation util, runtime-3 APK) + reverse-geocoded label; auto-detect
  on cold start unless a saved address was explicitly chosen; persists to AsyncStorage.
- `LocationSheet` reads the address `lat/lng` columns (was reading non-existent
  `latitude/longitude`).
- `HomeScreenV2` + `CategoryListScreen`: feed coords from `useAppLocation`, re-fetch
  on change, header tappable → `LocationSheet`, header shows `location.label`.

## Behaviour
- Cold start → auto-detected area + nearby feed. Tap header → current / add address /
  saved addresses. Pick another area (e.g. Hyderabad) → whole feed re-ranks +
  distances recompute. Selection persists; chosen address survives restart.
- Degrades to the default location when GPS/geocode unavailable — feed never blocked.

## Honest notes
- **OTA-only — no APK rebuild** (GPS native already in the v75/runtime-3 APK).
- Real GPS only on the runtime-3 APK; older builds/web → default location.
- Address coords from live forward-geocoding (Google billing now active).

## Verification
- babel transform 5/5 PASS (api, LocationContext, LocationSheet, HomeScreenV2,
  CategoryListScreen); `node --check` PASS on backend files.
- `pnpm qa`: **GREEN — 79 passed, C1 GREEN** (`qa/reports/2026-06-08T15-07-05-082Z/`).
  An earlier run showed 6 unrelated auth-invariant tests timing out at 60s (backend
  test-server slowness, 2.1m run) — re-run GREEN in 46.8s confirmed flake, not a
  regression (the location code those tests never touch).

## Release
**production-impacting**: Render backend + migration 093 (founder go) + follower OTA
(runtime 3). No APK rebuild. Maestro founder-side (recorded override).
