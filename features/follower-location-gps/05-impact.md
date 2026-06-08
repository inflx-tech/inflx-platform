# Impact — follower-location-gps (Contract 3)

**Verdict: adds real device-GPS behind an OTA-safe guard. Native dep + 2 mobile
files. No backend/data change. Inert until a new APK; safe if it rides an OTA first.**

## Mechanics
- New native dep + `utils/geolocation.js` (guarded require). `useLocation` upgrades
  to real GPS only when the module is present; otherwise the existing default. Every
  screen reading `useLocation` (Home, Category) benefits automatically; the location
  POST + distance render (Contracts 1/2) consume the real coords with no extra wiring.

## Risk
- **Low, by design.** The guard means the current app (no native module) is
  unaffected even if this JS reaches it via OTA → it returns the default (today's
  behaviour). Permission denial / GPS failure → default. Web QA unaffected (mobile).
- Reversible: remove the dep + revert the two files.

## Deploy
- **production-impacting — native APK** (NOT OTA). `released:false` until the founder
  builds + installs the APK; then flip released with APK evidence + (Mobile release)
  Maestro/override.
