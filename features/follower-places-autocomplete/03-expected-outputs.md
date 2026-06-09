# Expected Outputs — follower-places-autocomplete (Phase A)

## Files
- `backend/src/services/places.service.js` — autocomplete + details + placesHealth.
- `backend/src/controllers/follower.controller.js` — placesAutocomplete + placeDetails.
- `backend/src/controllers/geocoding.controller.js` — placesHealth handler.
- `backend/src/routes/follower.routes.js` — `/places/autocomplete` + `/places/details`.
- `backend/src/routes/index.js` — `/internal/places-health`.
- `Packages/Mobile/src/services/api.js` — placesAutocomplete + placeDetails.
- `Packages/Mobile/src/utils/recentLocations.js` — MRU recent list.
- `Packages/Mobile/src/screens/follower/LocationSearchScreen.js` — search UI.
- `Packages/Mobile/src/components/LocationSheet.js` — search bar entry.
- `Packages/Mobile/src/navigation/FollowerNavigator.js` — `LocationSearch` route.

## Acceptance checks
1. Type ≥2 chars → debounced predictions (location-biased); pick → coords → feed
   re-ranks + added to Recently searched.
2. Empty query → Recently searched list. "Use current location" works.
3. `/internal/places-health` → `places_status: OK` once Places API is enabled
   (REQUEST_DENIED until then → predictions empty, no crash).
4. No "Request Address" option. babel/node-check PASS; `pnpm qa` GREEN.

## Release classification
- **production-impacting**: Render backend + follower OTA (runtime 3). No migration,
  no APK. Prereq: founder enables **Places API**. Surfaced for go.
