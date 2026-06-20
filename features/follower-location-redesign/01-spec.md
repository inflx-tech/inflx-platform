# Feature Spec — Follower v2: Location flow redesign (white + yellow)

> Step 2 of the contract-driven workflow. Locked with the founder in chat 2026-06-20.

## Problem / goal
The follower app is being rebuilt design-first (`follower v2`) on a pure-white
canvas with a rationed yellow accent (the `toing` palette), replacing the
gold+cream `creatorVibe` look. This contract covers the **first slice: the
location flow** — the screens a follower sees to set/choose their delivery
location. Role: **follower**.

## Scope
- **In scope (Wave A — OTA reskin of working screens):**
  1. Location entry / permission screen (new screen)
  2. Select your location (reskin `LocationSearchScreen`)
  3. Search → autocomplete results (same screen, reskinned)
  4. Add new address (reskin `AddressScreen`)
  - The `toing` palette tokens in `theme/tokens.js`.
  - A `follower-v2` feature flag so the live app is untouched until proven.
- **In scope (Wave B — APK, later sub-slice):**
  5. Map pin picker (`react-native-maps` + Maps SDK for Android — native, needs APK).
- **Explicitly out of scope:** the opening/splash animation; any backend change
  (location/Places/geocoding/address APIs already exist and are reused as-is);
  the business switcher, food vertical, and all other verticals (later contracts).

## Surfaces touched
- App(s): mobile (follower)
- Roles involved: follower (public + authed)

## Data / contracts
- **New/changed tables/columns/migrations:** NONE. Reuses `follower_addresses`
  (+ migration 093 lat/lng) and the existing Places/geocoding backend proxy.
- **New/changed API endpoints:** NONE. Consumes existing
  `placesAutocomplete`, `placeDetails`, reverse/forward geocode, and
  `getAddresses` / `addAddress`.
- **Money/units, attribution IDs, status machines:** none affected.

## Non-functional
- **Auth/role gates:** location select works public; saving an address requires
  the follower auth gate (existing behaviour preserved).
- **Failure modes:** GPS denied/unavailable → graceful fallback to manual search
  (OTA-safe geolocation wrapper already handles this); autocomplete/geocode
  network failure → screen stays open, no crash; never persist an address
  without resolvable coords (existing enforcement kept).
- **Theme isolation:** v2 screens import `toing` explicitly; `creatorVibe` /
  `lightColors` / `brandPalette` untouched → zero change to any non-migrated
  follower screen or the brand/influencer apps.
