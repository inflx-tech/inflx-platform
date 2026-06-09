# Feature Spec — follower-places-autocomplete (Phase A of the Swiggy location flow)

> Founder ask 2026-06-08 (with Swiggy screenshots): type an area → live Google
> suggestions → pick → exact coords. Decision: **Phase A now (autocomplete, OTA)**;
> the map+draggable-pin is Phase B (needs Maps SDK + react-native-maps → APK).

## Goal
A "Select Your Location" search: as the follower types, show Google Places
predictions; picking one resolves exact coords and repositions the feed. Plus "Use
current location" + "Recently searched". (No "Request Address".)

## API note (answer to "is Geocoding enough?")
**No** — Geocoding can't do type-ahead predictions. This uses the **Places API**
(Autocomplete + Place Details), enabled on the same project/key (billing live).
The interactive map (Phase B) additionally needs Maps SDK + react-native-maps (APK).

## Scope
- **Backend (proxy — key stays server-side):**
  - `places.service.js`: `autocomplete(input,{session,lat,lng})` + `details(placeId,{session})`
    (session token = one billed session; location-biased to the follower's area).
  - `GET /follower/places/autocomplete` + `GET /follower/places/details` (public).
  - `GET /internal/places-health` (secret-safe diagnostic).
- **Mobile:**
  - `LocationSearchScreen` — debounced autocomplete → predictions → pick → details →
    coords → `setLocation` (feed re-ranks) + remember in "Recently searched".
  - `LocationSheet` — add a search bar → LocationSearchScreen; "Use current location"
    sub-text refreshed; keep Add-new-address; **no Request Address**.
  - `recentLocations` util (AsyncStorage MRU). Nav route `LocationSearch`.
- **Out of scope:** the map + draggable pin (Phase B, APK); Maps SDK.

## Surfaces touched
- backend: `places.service`, `follower.controller`, `geocoding.controller`
  (places-health), `follower.routes`, `routes/index`. mobile: `services/api`,
  `utils/recentLocations`, `screens/follower/LocationSearchScreen`,
  `components/LocationSheet`, `navigation/FollowerNavigator`.

## Data / contracts
- New public `GET /follower/places/autocomplete` + `/details`. Uses
  `GOOGLE_GEOCODING_API_KEY` (must have **Places API** enabled + in its restrictions).
  No migration. Picked location flows through the existing LocationContext.

## Non-functional
- OTA-only (no migration, no APK). Degrades to [] / no-results when Places API is off
  or rate-limited (never throws). Session tokens keep autocomplete billing efficient;
  results biased to the follower's coords. Prereq: founder enables **Places API**.
