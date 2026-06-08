# Workflow — follower-location-gps (Contract 3)

## Follower flow (once the APK is installed)
1. App open → `useLocation` detects the native module is present → requests Android
   location permission.
2. Granted → device GPS coords → the feed (Home + Category) ranks by real distance;
   HomeScreenV2 POSTs the coords → header shows the real area name.
3. Denied / no module / web → default location (current behaviour). Never blocks.

## Build
1. Add `@react-native-community/geolocation` dep.
2. `utils/geolocation.js` — guarded loader + permission + getCurrentPosition.
3. `useLocation` — default → real GPS when available.
4. Babel transform; `pnpm qa` GREEN.
5. **No OTA.** Founder builds + installs the APK to activate.

## End state
The follower's real location drives distance + area name automatically — live after
the next APK build. OTA-safe before then (falls back to default).
