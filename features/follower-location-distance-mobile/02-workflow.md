# Workflow — follower-location-distance-mobile (Contract 2)

## Follower flow
1. Home/Category load → feed calls send the follower's coords (`?lat&lng`) →
   backend ranks nearest-first + returns `distance_km`.
2. Brand / product / business-list cards show **"X km away"** (when `distance_km`
   present).
3. Logged-in: Home `POST /follower/location` → header shows the reverse-geocoded
   **area name** (else "Vijayawada").

## Build
1. `fmtDistance` in palette; `distanceKm` on the 3 cards; `SectionRenderer` passes it.
2. `CategoryListScreen` passes coords to `getCategorySections`.
3. `HomeScreenV2` posts location (logged-in) → area name; `api.updateLocation`.
4. Babel transform; `pnpm qa` GREEN; `06-diff/notes.md`; OTA.

## End state
A follower sees real distances on cards + their area at the top, ranked nearest-
first — over OTA, using the selected/default location. Auto-GPS = Contract 3 (APK).
