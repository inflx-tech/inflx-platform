# brand-register-location-picker

> Founder walkthrough W2 (2026-06-11, Docs/WALKTHROUGH_LEDGER.md): registration
> location should come from our existing geocoding/Places APIs — place search
> or a pasted Google Maps link — with manual entry kept as an option.

## Problem

Brand registration (`Packages/brand-web/app/login/page.js` step 3) takes the
address purely as typed text. Coordinates are never captured at signup even
though `brands` has lat/lng/locality/formatted_address columns (migrations
015 + 051) and distance-based follower discovery reads them — so every brand
registered through this form is invisible to "near you" ranking until someone
edits the profile.

## What exists already (verify-twice, all confirmed in code)

- `GET /v1/follower/places/autocomplete` + `/details` — Places proxy (server-side key), built for the follower address flow.
- `POST /v1/internal/geocode-maps-url` → `geocoding.resolveMapsUrl(url, {name, city})` — resolves any Google Maps URL shape; built for the restaurant listing wizard.
- `PATCH /v1/brands/me` (updateMe) already accepts google_maps_url/lat/lng/locality/formatted_address and keeps legacy latitude/longitude in sync.
- ONLY `POST /v1/brands/register` and the registration UI lack location capture.

## Scope

1. **UI (login/page.js, Location section):** three entry modes — 🔍 *Search place*
   (default; debounced autocomplete → pick → details autofills address, city,
   state, pincode + captures coords) · 🔗 *Google Maps link* (paste → resolve →
   autofill + coords) · ✍️ *Manual* (today's form, unchanged). All modes leave
   the fields editable; a "✓ Location captured" badge shows when coords exist.
2. **places.service.details:** also return `state` (administrative_area_level_1)
   and `pincode` (postal_code) from address_components — additive.
3. **brands/register:** accept optional `latitude/longitude/locality/
   formatted_address/google_maps_url`; if a URL is given resolve it server-side
   (same as updateMe); write lat/lng + legacy latitude/longitude + locality +
   formatted_address on the INSERT. All optional — manual registrations are
   byte-identical to today.

## Out of scope

Mobile brand app registration (separate screen, rides the mobile redesign);
storing the URL itself (no column); editing flow (updateMe already does it).
