# Feature Spec — follower-location-gps (Contract 3, native APK)

> Real device-GPS capture for the location/distance feature. Builds on Contract 1
> (backend) + Contract 2 (mobile render). **Native APK rebuild — NOT OTA.**

## Goal
On app open, capture the device's real GPS coordinates so distance ranking + the
area name use where the follower ACTUALLY is (instead of the selected/default
location). Auto, no manual area pick.

## Scope
- **In scope (native):**
  - Add `@react-native-community/geolocation` (native dep) to `Packages/Mobile`.
  - `src/utils/geolocation.js` — OTA-safe guarded loader: `isGpsAvailable()`,
    `ensureLocationPermission()` (Android `PermissionsAndroid`), `getCurrentPosition()`
    (never rejects → null on unavailable/denied).
  - `src/hooks/useLocation.js` — return the Vijayawada default, then upgrade to real
    GPS when the native module is present (every screen that reads this hook — Home,
    Category — gets real GPS automatically; HomeScreenV2 already POSTs the coords →
    area name + distance follow).
- **Explicitly out of scope:** any backend change (Contract 1 done); iOS (Android is
  the live target; Android manifest already has the location permissions); a
  manual location picker (the area-switcher already exists).

## Surfaces touched
- Mobile (follower): `package.json` (native dep), `src/utils/geolocation.js` (new),
  `src/hooks/useLocation.js`.

## Data / contracts
- Uses Contract 1's `POST /follower/location` + distance. No new endpoint/migration.

## Non-functional — OTA-safety (critical)
- The geolocation import is **guarded** (try/require + runtime check). On the current
  APK (no native module), web, or denied permission → `isGpsAvailable()` is false and
  the app keeps the default location. So this JS is **safe even if it rides an OTA
  bundle before the APK** — no crash for current users.
- **Ships in a native APK build** (`pnpm --filter Mobile android:follower` / the
  founder's APK pipeline), NOT an OTA. `released` stays false until the APK is built +
  installed. Permission denial degrades to the default — never blocks the feed.
