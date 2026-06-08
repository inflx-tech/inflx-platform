# Workflow — follower-location-switcher

## Follower flow
1. App open → `LocationContext` auto-detects (real GPS via the runtime-3 APK) →
   reverse-geocodes the area name → header shows it; feed ranks nearest to there.
2. Tap the header location → **LocationSheet**:
   - **Use current location** → GPS again (default).
   - **Add new address** → AddressScreen → save → backend forward-geocodes →
     stored with lat/lng.
   - **Saved addresses** → pick one → its coords reposition the feed.
3. Home + Category re-fetch with the chosen lat/lng → creators/brands/products/
   offers + "X km away" recompute for that area (e.g. Hyderabad).
4. Selection persists across app restarts (AsyncStorage); an explicitly-chosen
   address survives cold start (no GPS override).

## Build
1. Migration 093 (address lat/lng) + createAddress geocode + reverse-geocode endpoint.
2. LocationContext real GPS + reverse-geocode label + auto-detect.
3. LocationSheet reads lat/lng; Home/Category use useAppLocation + tappable header.
4. babel/node-check; `pnpm qa` GREEN.
5. Deploy: Render backend + migration 093 (founder go) + OTA (runtime 3). No APK rebuild.

## End state
The follower sees nearby content automatically and can switch to any saved/added/
current location from the header; the whole feed follows.
