# Impact — Follower v2 location flow

**Chat verdict:** Visual + new-screen only on the follower app; zero backend
change, zero functional disturbance to existing flows. Full mechanics below.

## Blast radius
- **Backend:** none. No routes, controllers, migrations, or env touched. All
  location/Places/geocoding/address endpoints are reused unchanged.
- **Other roles (brand/influencer):** none. `toing` is a new, separately-imported
  palette; `creatorVibe`/`lightColors`/`brandPalette` are byte-unchanged.
- **Existing follower screens:** none until the `follower-v2` flag is flipped.
  v2 lives alongside the current screens; nothing is deleted.

## Deploy posture
- Wave A = **OTA** (JS only). Production-impacting at OTA-publish time → surfaced
  for explicit go; not auto-deployed.
- Wave B (map) = **APK** (native module `react-native-maps`) — cannot OTA;
  separate release.

## Risks / mitigations
- *Theme bleed* → mitigated by explicit `toing` import + flag isolation.
- *GPS denial / network failure* → existing OTA-safe geolocation + open-screen
  failure handling reused.
- *Native crash risk (Wave B only)* → map screen verified via Maestro on device
  before any release flip (Rule 5).
