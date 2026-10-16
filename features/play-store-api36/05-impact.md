# Impact Analysis — the three apps on the Play Store (Android 16, API 36)

## In one line
The apps' foundation moves from React Native 0.73 to 0.81 so Google Play accepts them (target API 36,
16 KB memory pages). Every screen looks and sits where it does today. Phones only; no server, no data,
no website, no money path.

## Why
Play refused the uploads twice: first "minimum SDK 24" (11 Oct), then "must target at least API level
36" (16 Oct). API 36 needs React Native 0.81+; apps targeting 35+ must also ship 16 KB-aligned native
libraries, which 0.73 cannot (60 of 61 arm64 libraries were 4 KB aligned).

## What changes
- **App ids** (10 Oct, founder): `com.inflx.brand`, `com.inflx.influencer`, `com.inflx.followers`.
  Code stays in the `in.inflx.app` namespace. The staging twin keeps `in.inflx.app.follower.staging`.
  `google-services.json` carries a client for each new id, reusing the old ids' Firebase values (push is
  OneSignal); registering the new ids in Firebase is still owed.
- **Upload signing**: `gradlew bundle<App>Release -PplayRelease=<flavor>` signs that one app with its
  own key from `android/keystore.properties` (git-ignored; template `keystore.properties.example`).
  Without the flag, release builds keep the debug key, as the sideloaded APKs always have.
- **Version codes per app**: brand, influencer and follower each `versionCode 2` in their flavor
  (Play holds code 1). Raise by one for every accepted upload. Name stays "1.0".
- **SDK levels**: minimum 24 (Android 7), compile and target 36.
- **Toolchain**: React Native 0.81.6, React 19.1.4, Gradle 8.14.3, Kotlin 2.1.20, NDK 27.1, build tools
  36. Legacy architecture kept (`newArchEnabled=false`; 0.81 is the last line that allows it).
- **Libraries moved** (versions that still ship legacy-architecture code): react-native-screens 4.16.0,
  safe-area-context 5.6.1, svg 15.13.0, compressor 1.13.0, video 6.17.0. The x86_64 copy of
  compressor's MP3 library (`libandroidlame.so`, never loaded: audio is never compressed) is left out of
  the package so every 64-bit library passes the 16 KB check.
- **System bars** (Android 15/16 draw every app edge to edge): React Native's own edge-to-edge switch
  stays OFF (on, it forces each Modal under the bars and drops the container that keeps a sheet above
  the keypad). `MainActivity` makes the window edge to edge on every version and pads it by the
  keyboard; `components/shell/SystemBarFrame.js` (wrapped round the app in `App.js`) paints the old
  grey status bar and black navigation bar and gives every screen an inset of 0, as before.
  `MainActivity` also sets react-native-screens' fragment factory (its Android requirement).
- **Over-the-air**: `NATIVE_RUNTIME` 3 → 4. A bundle published from this code reaches only the new
  builds; runtime-3 phones (the sideloaded APKs) keep their last bundle and get no more updates.
- **Tests**: nine updated for React 19 / the newer testing library — harness only, nothing asserted
  changed (ES-module test kit; a second render stops events reaching the first; look a pushed screen up
  outside `act()`; let after-load effects settle; native-driver fades report no values in tests, so the
  fade test reads the opacity being faded to).
- **Demo login for Play review**: `backend/scripts/add-play-review-account.js` put `+917900000200` on
  `test_phone_numbers` (10 Oct, already done in production); the follower account "Demo Shopper".

## Verified
- Jest: 3021 / 3021 pass (before the upgrade: 3014 / 3021).
- Bundles: target 36, minimum 24, code 2 / "1.0", each signed by its own key, every arm64 and x86_64
  library 16 KB aligned.
- Android 14 emulator (Pixel 6), production data: brand as "Label Fern (practice)" (sign-in with
  keypad, code screen, five tabs, alert, picker sheet with and without keypad, a main-window field
  with keypad, side by side with the live APK); creator as "Divya T. (practice)" (home, tabs, an
  invitation and back); shopper as a guest (welcome, feed video playing, product sheet, Play tab).

## Not verified
- A real Android 15 or 16 phone (no such emulator image here).
- Push notifications under the new ids.

## Deploy / rollback
- **Deploys**: nothing on merge. A push redeploys Render and Vercel with no server or website change.
  The next `publish-ota.js` publishes for runtime 4 only.
- **Before any OTA from this code**: `npm ci` in `Packages/Mobile` (0.81 packages), or the bundle is
  built with the old library code.
- **Rollback**: revert the merge commit (`git revert -m 1 <merge>`); OTA for runtime 3 then resumes.
  The Play builds keep running their built-in code either way.
