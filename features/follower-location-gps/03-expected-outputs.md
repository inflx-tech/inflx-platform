# Expected Outputs — follower-location-gps (Contract 3)

## Files
- `Packages/Mobile/package.json` — `@react-native-community/geolocation` dep.
- `Packages/Mobile/src/utils/geolocation.js` — NEW OTA-safe GPS accessor.
- `Packages/Mobile/src/hooks/useLocation.js` — default → real GPS when available.

## Acceptance checks
1. `isGpsAvailable()` false when the native module is absent (current APK / web) →
   `useLocation` returns the default (no crash, OTA-safe).
2. With the module present (new APK) + permission granted → `useLocation` returns
   real device coords; Home/Category rank by real distance; header shows real area.
3. Permission denied / GPS error → default; feed never blocked.
4. Babel transform PASS; `pnpm qa` GREEN.

## Release classification
- **production-impacting — native APK** (not OTA). `released` stays false until the
  founder builds + installs the APK. The JS is OTA-safe if it rides a future OTA
  (guards → default on the old APK). gov-check: contract + mockup_locked + 06-diff
  for the src/ path; Maestro/Rule 5 not triggered while released=false.

## Activation (founder, when ready)
- `npm install` in `Packages/Mobile` (pulls the native dep) → build the follower APK
  (Android autolinking picks up the module; manifest already has the permissions) →
  install. Then flip `released=true` with the APK evidence.
