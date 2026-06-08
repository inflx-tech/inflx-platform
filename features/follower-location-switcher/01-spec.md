# Feature Spec — follower-location-switcher

> Founder request 2026-06-08: follower opens app → location auto-detected →
> nearby creators/brands/offers. Tap the header → switch location (current /
> add address / saved addresses) to browse another area (e.g. Hyderabad).
> Builds on the location/distance feature (Contracts 1–3, all live).

## Goal
The header location is tappable → a switcher with: **Use current location** (real
GPS, default), **Add new address**, and **Saved addresses**. Picking any of them
repositions the whole feed (Home + Category) to that area — nearest-first +
"X km away" recompute for the chosen location.

## Scope
- **Backend**
  - Migration **093**: `follower_addresses += lat, lng`.
  - `createAddress` forward-geocodes the typed address → stores `lat/lng` (uses
    client-sent coords if provided, e.g. "current location" → save).
  - Public `GET /follower/reverse-geocode?lat&lng → {area_name}` for the
    switcher's "current location" label.
- **Mobile**
  - `LocationContext` = the single feed-location source: `useCurrentLocation()` →
    real GPS (geolocation util) + reverse-geocoded label; auto-detect on cold
    start unless a saved address was explicitly chosen; persist (AsyncStorage).
  - `LocationSheet` (exists): "Use current location" / "Add new address" (→
    AddressScreen) / saved addresses (now carry coords). Fix it to read `lat/lng`.
  - `HomeScreenV2` + `CategoryListScreen`: read feed coords from `useAppLocation`,
    re-fetch on change, header tappable → `LocationSheet`, show `location.label`.
- **Out of scope:** new GPS native code (already in the runtime-3 APK); map-pin
  picker UI; per-address editing beyond add/select.

## Surfaces touched
- Backend: migration 093, `follower.controller` (createAddress, reverseGeocode),
  `follower.routes`. Mobile: `LocationContext`, `LocationSheet`, `HomeScreenV2`,
  `CategoryListScreen`, `services/api`.

## Data / contracts
- `follower_addresses.lat/lng` (new). `GET /follower/reverse-geocode` (new, public).
  `createAddress` now geocodes. No change to the section payload contract.

## Non-functional
- OTA-only (no native change → no APK rebuild; GPS already in the runtime-3 APK).
- Backend-first: address coords from real geocoding (live now); reverse-geocode
  cached (~100 m). Degrades to default location when GPS/geocode unavailable —
  never blocks the feed. Geocoding cost only on add-address + first label per area.
