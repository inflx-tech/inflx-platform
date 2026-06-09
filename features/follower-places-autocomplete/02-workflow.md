# Workflow — follower-places-autocomplete (Phase A)

## Follower flow
1. Tap header location → sheet (Use current location · Add new address · Saved) +
   a **search bar** → opens "Select Your Location".
2. Type "kphb" → debounced → **live predictions** (KPHB METRO, KPHB Colony …),
   biased to the follower's current area.
3. Pick one → Place Details → exact coords → set as the app location (feed re-ranks)
   + saved to "Recently searched" → back to the feed.
4. Empty query → "Recently searched" list. "Use current location" → GPS.

## Build
1. Backend: places.service (autocomplete/details/health) + 2 public routes +
   places-health route.
2. Mobile: LocationSearchScreen (debounced autocomplete + recent) + LocationSheet
   search bar + recentLocations util + nav route + api methods.
3. babel/node-check; `pnpm qa` GREEN; OTA.
4. Founder enables **Places API** on the project/key; verify via /internal/places-health.

## End state
Typing an area shows real Google suggestions; picking one moves the whole feed to
that area. (Map + draggable pin = Phase B, APK.)
