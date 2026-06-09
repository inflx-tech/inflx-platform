# Before / After — follower-places-autocomplete (Phase A)

## Before
Location entry was typed + verify (Geocoding). No type-ahead suggestions (Geocoding
can't predict).

## After (what shipped — Phase A, OTA)
**Backend (Places proxy, key server-side)**
- `places.service.js` — `autocomplete(input,{session,lat,lng})` + `details(placeId,
  {session})` (session-tokened, location-biased) + `placesHealth()`.
- `GET /follower/places/autocomplete` + `GET /follower/places/details` (public).
- `GET /internal/places-health` (secret-safe diagnostic).

**Mobile**
- `LocationSearchScreen` — "Select Your Location": debounced live predictions →
  pick → Place Details → coords → `setLocation` (feed re-ranks) + Recently-searched.
  Empty query → Recently-searched; "Use current location" row.
- `LocationSheet` — search bar → LocationSearchScreen; current-location sub-text
  refreshed; no "Request Address".
- `recentLocations` util (AsyncStorage); `LocationSearch` nav route; api methods.

## Behaviour
Type "kphb" → KPHB METRO / KPHB / KPHB Colony … (biased to the follower's area) →
pick → whole feed moves to that area. Matches the Swiggy search screenshot.

## Honest notes / decision
- **Phase A only** — the **map + draggable pin** ("place the pin at exact location")
  is **Phase B** (needs Maps SDK + react-native-maps → APK rebuild).
- Needs the **Places API** enabled on the project/key (Geocoding alone can't do
  predictions). Until enabled, predictions return empty (no crash) — verify via
  `/internal/places-health` (`places_status: OK`).

## Verification
- node --check (backend) + babel 5/5 (mobile) PASS.
- `pnpm qa`: **GREEN — 79 passed, C1 GREEN** (`qa/reports/2026-06-09T00-54-22-497Z/`).
  First run = the recurring 6-auth-test 60s-timeout flake; re-run GREEN 48.9s.

## Release
**production-impacting**: Render backend + follower OTA (runtime 3). No migration,
no APK. Prereq: founder enables Places API. Maestro founder-side (recorded override).
