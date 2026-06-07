# Before/After — Add-menu cuisines + location mock-off

Mockup locked: `04-preview/mockups/01-add-menu-cuisines.html`.

## What shipped (matches the mockup)
- **Saved cuisines load.** `RestaurantDishPicker.brandCuisines` now falls back to
  `brand.listing_data.cuisines` (then unions session-added) — a returning brand sees its
  cuisines + dishes instead of "No dishes available… (none)".
- **Inline "➕ Add cuisine"** in the cuisine nav: lists catalogue cuisines not yet added;
  picking one sets it active, shows its dishes (already loaded), and persists to
  `listing_data.cuisines` via PATCH /brands/me (non-blocking).
- **Empty state is a cuisine picker** (was a "go back to step 1 / Bulk Upload" dead-end).
- Flow is Cuisine → Section → Dish; business setup stays behind its own door.
- **Location mock-off:** `GEOCODING_MOCK` is now opt-in (default OFF) so prod runs the real
  short-link path — the pasted share link resolves to real coords, no more fixed Vijayawada
  / "MOCK MODE" badge.

## Honest divergences
- Add-cuisine persists via the existing brand-profile PATCH (no new endpoint); if that
  PATCH fails the cuisine still shows for the session (non-blocking) and will need a retry
  to persist — acceptable, surfaced only in console.
- Paid Google reverse-geocode (auto area NAME) remains deferred; the owner types locality.
- If prod has an explicit `GEOCODING_MOCK=true` Render env var, it must be removed
  (operator) — the code default flip alone fixes the common (unset) case.

## Verification
- `pnpm qa` GREEN (web/api/unit). Founder manual verify on the live brand-web: re-open
  Add-Menu shows saved cuisines + "Add cuisine"; Location resolves the real area.
