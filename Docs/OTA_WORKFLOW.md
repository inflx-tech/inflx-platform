# OTA JS-bundle workflow

Once users install the APK with the OTA loader built in, every future JS
change reaches their phone without a reinstall.

## How it works

```
 laptop                              Render (backend)                    Cloudflare R2
 ------                              ----------------                    -------------
 pnpm publish-ota:all                [POST /v1/ota/publish]              ota/brand/manifest.json
 │  1. react-native bundle  ───►     │  verifies X-OTA-Token              ota/brand/bundle-<N>.js
 │  2. POST base64 bundle   ───►     │  uploads bundle → R2               ota/influencer/...
 │                                    │  rewrites manifest.json            ota/follower/...
 │                                    │
 └─── done (10 seconds)              [GET  /v1/ota/manifest?flavor=..]
                                      │  reads manifest from R2
                                      │  returns + signs bundle URL

 phone (installed APK, every app launch)
 ---------------------------------------
 1. App.js runs checkForOtaUpdate()
 2. Fetch manifest for this flavor + native runtime
 3. If newer version → download bundle to <filesDir>/ota/bundle.js
 4. Write ready.marker sidecar
 5. User keeps using current bundle this session
 6. Next app launch: MainApplication.getJSBundleFile() returns the
    cached bundle instead of the APK-baked one
```

## Daily loop

```
# change code
git push origin main            # Vercel + Render redeploy web/backend
pnpm publish-ota:all             # phones pick up on next launch
```

That's it.

## Per-flavor publish

```
pnpm publish-ota:brand
pnpm publish-ota:influencer
pnpm publish-ota:follower
pnpm publish-ota:all --message "commission neg form redesign"
```

The `--message` is stored on the manifest — useful when debugging "what
version am I actually running?" from logs.

## Native code changes — rare, needs APK rebuild

Whenever we add a native library, change gradle config, or edit anything
under `Packages/Mobile/android/**` that isn't Kotlin in `.../in/inflx/app/`:

1. **Bump** `NATIVE_RUNTIME` in `Packages/Mobile/src/services/otaUpdater.js`
   (e.g. `'1'` → `'2'`).
2. Rebuild the 3 release APKs and reinstall on every test device.
3. THEN publish an OTA bundle with the new `NATIVE_RUNTIME`.

Phones running the OLD APK will refuse to load the new bundle (mismatched
runtime) and stay on their baked-in bundle until they're reinstalled.
This prevents a JS bundle from calling a native module that doesn't exist
in the user's APK, which would otherwise crash on launch.

## Debugging

- Manifest check from the laptop:
  `curl 'https://inflx-platform.onrender.com/v1/ota/manifest?flavor=influencer&runtime=1'`
- View bundle log on the phone via `adb logcat | grep -i ota`:
  - `[OTA] Bundle v3 ready — will activate on next launch`
  - `[OTA] Skip — native runtime mismatch`
- Rescue: the native `OtaUpdater.reset()` method wipes the cached bundle
  and forces the app to fall back to the APK-baked JS. Exposed via JS
  import `{ NativeModules } from 'react-native'; NativeModules.OtaUpdater.reset()`.

## Secrets

- `OTA_PUBLISH_TOKEN` — must match in both:
  - `.env.ota` on the dev laptop (gitignored)
  - Render backend env var
- Token rotation: generate a new one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
  update both places, re-deploy the backend.
