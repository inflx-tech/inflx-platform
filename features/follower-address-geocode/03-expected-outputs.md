# Expected Outputs — follower-address-geocode

## Files
- `backend/src/controllers/follower.controller.js` — `geocodeQuery` handler +
  `createAddress` 422-enforce when not locatable.
- `backend/src/routes/follower.routes.js` — `GET /follower/geocode`.
- `Packages/Mobile/src/services/api.js` — `geocodeAddress(q)`.
- `Packages/Mobile/src/screens/follower/AddressScreen.js` — Verify + Use-current-
  location + located/error message + Save requires coords.

## Acceptance checks
1. "🔎 Verify address" on a real address → "✓ Located: {area}"; on gibberish →
   "Couldn't locate…".
2. "📍 Use current location" → fills + locks GPS coords (runtime-3 APK).
3. Save with no locatable coords → **blocked** (UI message + backend 422). Save with
   coords → persists with lat/lng → selectable in the switcher → repositions feed.
4. Editing a field after verify clears the stale "located" state (re-verify).
5. babel/node-check PASS; `pnpm qa` GREEN.

## Release classification
- **production-impacting**: Render backend + follower OTA (runtime 3). No migration
  (093 already added coords), no APK rebuild. Surfaced for go.
