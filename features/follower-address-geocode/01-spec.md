# Feature Spec — follower-address-geocode

> Founder ask 2026-06-08: added addresses must be **Google-geocode recognised**,
> not free-text. Decision: "best user-friendly using the available Geocoding API"
> (Places Autocomplete needs a separate Places API — out of scope). Builds on
> follower-location-switcher.

## Problem
Adding an address was free-text + best-effort geocode that **saved even when Google
couldn't locate it** (null coords → useless for the feed, no error). Not enforced.

## Goal — user-friendly + enforced, using only the Geocoding API
- **Enforce:** an address that Google can't locate is **rejected** (no null-coord save).
- **Verify:** a "🔎 Verify address" action forward-geocodes the typed fields and shows
  the match ("✓ Located: {area}").
- **Current location:** a "📍 Use current location" button (GPS → reverse-geocode →
  fills + locks coords) — one-tap guaranteed-locatable address.

## Scope
- **Backend:** `GET /follower/geocode?q=` (forward-geocode verify) ·
  `createAddress` rejects 422 when not locatable (uses client coords if sent).
- **Mobile (AddressScreen):** Verify button + Current-location button + located/
  error message; Save requires resolved coords (else blocked); passes lat/lng.
- **Out of scope:** Google Places Autocomplete (separate API); editing existing
  addresses' coords (re-add).

## Surfaces touched
- `backend/src/controllers/follower.controller` (geocodeQuery + createAddress
  enforce), `follower.routes`, `Packages/Mobile/src/services/api`,
  `screens/follower/AddressScreen`.

## Data / contracts
- Uses `follower_addresses.lat/lng` (migration 093, already live) + the live
  Geocoding API. New public `GET /follower/geocode`. No migration.

## Non-functional
- OTA-only (no migration; uses runtime-3 APK GPS for current-location).
- Enforced geocodability → every saved address has coords. Geocode failure /
  Google down → clear blocking message (no silent bad save). Geocoding cost only on
  Verify + Save + current-location reverse (cached).
