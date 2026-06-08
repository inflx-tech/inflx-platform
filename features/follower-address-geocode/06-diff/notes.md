# Before / After — follower-address-geocode

## Before
Add-address = free-text form; `createAddress` best-effort geocode that **saved even
when Google couldn't locate it** (null coords, no error). Not enforced.

## After (what shipped)
**Backend**
- `GET /v1/follower/geocode?q=` — forward-geocode verify → {found, lat, lng,
  formatted_address, area_name}.
- `createAddress` **rejects 422** when neither client coords nor a forward-geocode
  resolves → no null-coord saves (uses client coords when sent, e.g. current-location).

**Mobile — AddressScreen**
- **📍 Use current location** → GPS → reverse-geocode → fills city + locks coords.
- **🔎 Verify address** → shows "✓ Located: {area}" or "Couldn't locate…".
- **Save requires resolved coords** (verified/current, else geocodes once; else
  blocked with a clear message). Editing a field clears the stale "located" state.
- `services/api.geocodeAddress`.

## Behaviour
Only Google-recognised addresses save, each with coords → selectable in the location
switcher → repositions the feed. Unlocatable input is blocked, not silently saved.

## Honest notes / decision
- Per founder: **best user-friendly using the available Geocoding API.** Real Places
  **Autocomplete** (live type-ahead dropdown) needs the separate **Places API** —
  out of scope; this delivers verify + current-location + enforcement on Geocoding.
- Current-location GPS needs the runtime-3 APK (installed); else type + Verify.

## Verification
- node --check (backend) + babel 2/2 (api, AddressScreen) PASS.
- `pnpm qa`: **GREEN — 79 passed, C1 GREEN** (`qa/reports/2026-06-08T15-34-20-507Z/`).

## Release
**production-impacting**: Render backend + follower OTA (runtime 3). No migration
(093 live), no APK rebuild. Maestro founder-side (recorded override).
