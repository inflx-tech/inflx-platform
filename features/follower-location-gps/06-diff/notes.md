# Before / After — follower-location-gps (Contract 3)

## What shipped (code committed; activates on next APK)
- `package.json` — `@react-native-community/geolocation` (native dep).
- `src/utils/geolocation.js` — OTA-safe guarded GPS accessor: `isGpsAvailable()`,
  `ensureLocationPermission()` (Android), `getCurrentPosition()` (never rejects).
- `src/hooks/useLocation.js` — returns the Vijayawada default, then upgrades to real
  device GPS when the native module is present.

## Behaviour
- **Current APK / web / denied:** `isGpsAvailable()` false → default location
  (today's behaviour exactly). OTA-safe.
- **Next APK (module linked) + permission granted:** real device coords flow into
  Home + Category (distance re-ranks) and the location POST (real area name) — no
  extra wiring, since both already read `useLocation` / post coords (Contracts 1/2).

## Honest divergences / notes
- **Not OTA — ships in a native APK build.** `released:false` until the founder
  builds + installs the APK and confirms.
- The guarded require is the key safety: this JS will NOT crash the current app even
  if it reaches it via a future OTA bundle.
- iOS not targeted (Android live); Android manifest already has the permissions.

## Verification
- Babel transform via `module:@react-native/babel-preset`: **2/2 PASS**
  (geolocation.js, useLocation.js).
- `pnpm qa`: GREEN (mobile-only; web unaffected).
- Activation/APK smoke = founder, recorded at the released flip.

## FIX 2026-06-08 (founder device test — GPS was not active)
Founder installed the fresh APK in a different city but still saw "Vijayawada" +
Vijayawada-relative distance. Root cause: **NATIVE_RUNTIME was not bumped** when the
geolocation native module was added — so the new APK fetched the latest OTA bundle
(v74, pre-GPS, tagged runtime "2") and ran THAT instead of its baked-in GPS bundle.
Fix: `otaUpdater.js` NATIVE_RUNTIME '2' → '3'. The runtime-3 APK no longer accepts
the runtime-2 bundle → runs its baked GPS JS; a runtime-3 OTA (v75) is published for
future updates. Requires the APK rebuild (this contract's activation step).
