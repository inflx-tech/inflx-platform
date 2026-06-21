# Feature Spec — Fixes: redundant listing address + search exact-match ranking

> Founder walkthrough findings (2026-06-21) while registering a new restaurant +
> listing. Two functional fixes + one confirmation.

## Problem / goal
1. **Redundant address** — a restaurant enters its address at registration, then
   the listing wizard asks for location AGAIN (the "Location" step:
   google_maps_url + locality, writing the same `brands` columns). Redundant.
2. **Search exact-match ranking** — typing a dish name (e.g. "upma") must put the
   exact match on top. Confirmed working, but the recent flywheel merge weakened
   tie-ordering; harden it to guarantee exact-first.
3. (Confirmation only — no change) Dish image admin upload already exists.

## Scope
- In scope:
  - Skip the wizard "Location" step when the brand already has location from
    registration (lat/lng / locality / formatted_address / listing_data
    google_maps_url|locality). Still editable via "Edit business profile".
  - Surface the brand's stored location in `GET /brands/me/listing-config` so the
    client can make that decision.
  - Harden `dishFlywheel.searchMasterDishes` ranking: exact name match first,
    then similarity, canonical-before-custom, popularity, name.
- Out of scope: any new mockup (bug-fix to existing flow); dish image upload
  (already built).

## Surfaces touched
- backend: brand.controller.getListingConfig (+4 fields); dishFlywheel.service.
- brand-web: ListingTemplateLayout (drop Location step when location present).

## Data / contracts
- No schema change. `listing-config` response gains lat/lng/locality/
  formatted_address. Search response ordering changes only.

## Non-functional
- Location step still reachable via Edit-setup mode (not lost, just not forced).
- Exact-match ranking proven by test (type "upma" → "Upma" first).
