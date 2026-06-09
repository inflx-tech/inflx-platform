# Workflow Prediction — follower-places-autocomplete (Phase A)

## Design source
Founder's Swiggy screenshots — the "Select Your Location" search (type "kphb" →
KPHB METRO / KPHB / KPHB Colony …) + Use-current-location + Recently-searched. This
contract builds that search (Phase A). The map+draggable-pin screen is Phase B (APK).

## What the reviewer should see
- Header → sheet with a **search bar** + Use-current-location + Add-new-address +
  Saved (no "Request Address").
- Search bar → "Select Your Location": typing shows **live Google predictions**
  (main + secondary text, location-biased). Pick → feed re-ranks to that area +
  appears under "Recently searched" next time.

## Honest notes / decision
- Phase A = **Places Autocomplete only** (the search). The **map with draggable
  pin** ("place the pin at exact location" → Confirm & proceed) is **Phase B** —
  it needs the Maps SDK + react-native-maps (native → APK rebuild).
- Requires the **Places API** enabled on the project/key (Geocoding alone can't do
  predictions). Verify via /internal/places-health.
- Location-biased to the follower's current coords for better local matches.

## After-capture
Founder device smoke: type an area → suggestions appear → pick → header + feed
update. (After enabling Places API.)
