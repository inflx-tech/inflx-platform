# Feature Spec — Add-menu cuisines + location mock-off

> Status: LOCKED (founder 2026-06-07 "your flow is ok. pls implement"). Follow-up to
> listing-restaurant-edit-surfaces. UI-governed (brand-web) + a backend one-liner.

## Problem / goal
Founder dogfood (2026-06-07) surfaced two issues:
1. **Location is faked.** Prod runs geocoding in MOCK MODE (default opt-out), returning a
   hard-coded "MG Road, Vijayawada" for every pasted link — the badge literally shows
   "MOCK MODE". The free short-link fix (shipped) never runs because mock short-circuits.
2. **Add-menu shows "No dishes available… cuisines you picked (none)."** A registered
   brand re-opening just to add menu starts with empty wizard state; the dish picker reads
   `wizardState.cuisines` (empty) instead of the SAVED `brand.listing_data.cuisines`.
   Also (design): **cuisine management belongs WITH the menu** (a frequent activity), not
   behind "Edit business setup" (rare). The owner should pick/add cuisines right in the
   Add-Menu surface. Flow confirmed: **Cuisine → Section → Dish.**

## Scope
- **In scope:**
  - **A. Location mock-off (backend).** `GEOCODING_MOCK` becomes **opt-in** (default OFF;
    `=== 'true'` to enable). Prod then runs the real path: short-link expansion → coords
    from the pasted link; locality typed manually (free). Paid auto-address still deferred.
  - **B. Add-menu reads saved cuisines (brand-web).** `RestaurantDishPicker.brandCuisines`
    falls back to `brand.listing_data.cuisines` when the in-session value is empty → dishes
    show for a returning brand.
  - **C. Cuisine-in-menu (brand-web).** Inline "➕ Add cuisine" in the cuisine nav + a
    cuisine-picker empty state (replacing the "go back to step 1" dead-end). Adding a
    cuisine reflects locally (its dishes are already loaded) and persists to
    `listing_data.cuisines` via PATCH /brands/me — no "Edit business setup" trip.
- **Out of scope:** the paid Google auto-address; non-restaurant verticals; changing the
  rare business-setup door (hours/cost/location/photos stay there).

## Surfaces touched
- backend: `geocoding.controller.js` (mock default).
- brand-web: `RestaurantDishPicker.js` (cuisine sourcing + add-cuisine UI + empty state).
- Roles: brand (restaurant). No follower/admin change.

## Data / contracts
- No migration. Reuses PATCH /brands/me (listing_data.cuisines), GET
  /brands/me/master-catalogue, POST /internal/geocode-maps-url.
- Money/units/attribution: none changed.

## Non-functional
- Auth/role gates: unchanged.
- Failure modes: add-cuisine PATCH is non-blocking (local state still reflects it);
  geocode mock-off degrades to "paste full URL" if a short link can't be expanded;
  no test relied on mock default-on (verified).
- Gate: `pnpm qa` green; UI-governed → mockup-lock + 06-diff; Render + Vercel deploys
  surfaced for explicit founder go.
