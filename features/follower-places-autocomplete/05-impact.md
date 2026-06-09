# Impact — follower-places-autocomplete (Phase A)

**Verdict: adds Google Places type-ahead area search (Swiggy-style) via a
server-side proxy. New read endpoints + a search screen. No migration, no APK.
Needs the Places API enabled.**

## Mechanics
- Backend proxies Places Autocomplete + Details (key server-side). Mobile
  LocationSearchScreen does debounced search → pick → coords → LocationContext
  setLocation (feed re-ranks). Recently-searched in AsyncStorage.

## Risk
- **Low.** New endpoints + one new screen; additive. Degrades to empty results when
  Places API is off / rate-limited (no crash). Web QA unaffected. Cost: Places
  Autocomplete/Details (session-tokened → cheap). Reversible: revert files.

## Deploy
- **production-impacting**: Render backend + follower OTA (runtime 3). No migration,
  no APK. Prereq: enable **Places API** on the project/key. Surfaced for go.
- Phase B (map + draggable pin) deferred: needs Maps SDK + react-native-maps (APK).
