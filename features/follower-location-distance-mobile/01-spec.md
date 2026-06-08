# Feature Spec — follower-location-distance-mobile (Contract 2, OTA)

> Mobile render for the location/distance feature. Builds on Contract 1
> (`follower-location-distance` backend: coords + Haversine + `distance_km` +
> `POST /follower/location`). OTA-only. Auto device-GPS = Contract 3 (next APK).

## Goal
Consume the backend's `distance_km` + area name so the follower SEES nearest-first
discovery: **"X km away"** on brand/product/business-list cards and the **area name**
in the Home header. Works off the existing selected/default location (no APK).

## Scope
- **In scope (mobile, OTA):**
  - `vibe/palette.js` — `fmtDistance(km)` ("X km away" / "N m away").
  - `vibe/ShelfBrandCard`, `ShelfProductCard`, `ShelfBrandListRow` — render
    `distance_km` (additive `distanceKm` prop).
  - `SectionRenderer` — pass `item.distance_km` to those cards.
  - `CategoryListScreen` — pass device/selected coords to `getCategorySections`
    (Home already passes them) so Category distance-ranks too.
  - `HomeScreenV2` — `POST /follower/location` (logged-in) → show the returned
    `area_name` in the header (fallback "Vijayawada").
  - `services/api.js` — `followerApi.updateLocation(lat,lng)`.
- **Explicitly out of scope:** auto device-GPS (Contract 3 / APK); offer-card
  distance (offer rules don't compute it yet); rating (no data).

## Surfaces touched
- Mobile (follower) only. Card changes are additive (`distanceKm` prop) → other
  screens unaffected.

## Data / contracts
- Consumes Contract 1: `distance_km` on items; `POST /follower/location → {area_name}`.
  Coords come from `useLocation` (Vijayawada default today; real GPS in Contract 3).
  No backend change here.

## Non-functional
- OTA-only. Backend-first: distance shows only when `distance_km` is present (a
  brand with no coords shows none — honest). Area name only when reverse-geocode
  succeeds; header falls back to "Vijayawada". Location POST is best-effort
  (logged-in, silent-catch) — never blocks the feed.
