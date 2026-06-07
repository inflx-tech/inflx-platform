# Feature Spec — Restaurant edit surfaces: split Menu vs Profile + free location

> Order: restaurant-listing usability wave 1 · Depends on: — · Status: STUB (draft, not locked).
> Surfaced by founder dogfood (2026-06-07): wizard re-asks stable steps on re-entry;
> Google Maps link fails; menu (frequent) and profile (rare) should be separate surfaces.
> UI-governed (brand-web) + a backend geocoding change.

## Problem / goal
A first-time restaurant fills one linear 9-step wizard (Basics→Location→Hours→Dining→
Photos→Menu→Actions→Preview→Done). After that, the seller's real day-to-day need is
**adding/editing menu items** (frequent) — but the product forces them back through the
**stable profile steps** (rare). The existing auto-skip heuristic (`canSkipBrandSteps`:
needs `myProducts.length>0` AND all required brand fields filled) is brittle and is
failing for the founder (re-asks Basics/Location/Hours on every "Add Listing"). Also the
**Location step's Google Maps link fails** for the share-link format every owner actually
uses. Goal: make **menu** and **profile** two explicit post-setup surfaces, kill the
re-ask, and make location work from a normal share link **without a paid Google API**.

## Scope
- **In scope:**
  - **A. Two explicit post-setup surfaces (brand-web).**
    - First-time (no published profile yet) → the existing full wizard, unchanged.
    - Returning (profile exists) → dashboard shows two doors:
      - **Manage Menu** — dish list (inline edit/remove) + "+ Add dish" that opens ONLY
        the menu picker (cuisine → section → item → price/veg/spice/portion/photo).
        No brand/profile steps. Reuses `RestaurantDishPicker` in a standalone host.
      - **Edit Restaurant Profile** — a sectioned editor (Basics · Location · Hours ·
        Dining · Photos · Actions); each section independently saved (PATCH /brands/me).
    - Replace the brittle skip heuristic with a **reliable returning-vs-first-time signal**
      (brand has a non-empty published profile, e.g. required brand fields present on the
      server-returned `listing_data`) so the re-ask trap cannot recur.
  - **B. Free location fix (backend + small brand-web).**
    - Server-side **short-link expansion**: when the pasted URL is `maps.app.goo.gl/*` or
      `goo.gl/maps/*`, follow the redirect to the full URL, then run the existing coord
      regex. (`geocoding.controller.js` currently rejects short links.)
    - Keep/clarify the **manual locality/area field** so the area name shows without the
      paid reverse-geocode.
  - **C. Quality-score backend defect (genuine bug, found 2026-06-07 dogfood).**
    `calculateQualityScore` (`listing.service.js:~205`) reads brand profile fields from
    the typed `brands` columns (`business_name,city,category`) but the wizard SAVES them
    in `brands.listing_data` JSONB → every brand-scope rule scores `earned:false` → 0/100
    even when fully filled. Fix: read profile fields from `listing_data` (merge typed +
    json). Add a regression test (RED→GREEN).
  - **D. Dish defaults — blank photo + explicit price/photo capture (brand-web).**
    On master-dish add, STOP pre-filling `image_url` from `masterRow.default_image_url`
    (`RestaurantDishPicker.js:150`) — start blank with a placeholder. After selecting a
    dish, make setting **(1) the owner's own price** and **(2) the owner's own photo** an
    explicit, prominent per-dish capture (inline edit already exists; surface it as a
    clear "set these two" prompt, not a buried optional). Master suggested-price may
    pre-fill the price input as a hint but the photo starts empty.
  - **E. Menu list reliability.** "Your Menu / Menu(N)" + the post-publish view must read
    the server's `GET /brands/me/products` (fresh) so the count is never stale (the Manage
    Menu surface in A does this by construction; ensure post-publish refresh is awaited).
  - **C0. Re-entry signal.** Replace the brittle `canSkipBrandSteps` heuristic with a
    reliable returning-vs-first-time signal so the re-ask trap cannot recur.
- **Explicitly out of scope:**
  - **Paid Google Geocoding API** auto-address (founder chose "paid later") — leave a
    documented `GOOGLE_GEOCODING_API_KEY` hook + `GEOCODING_MOCK=false` note; no key wired.
  - Other verticals (listing engine frozen for non-restaurant per founder).
  - Dish Detail attribute rendering / variants on the follower app (separate wave).

## Surfaces touched
- App(s): **brand-web** (`app/dashboard/products/*` — wizard host, new Manage-Menu +
  Edit-Profile surfaces, dashboard entry buttons); **backend** (`geocoding.controller.js`
  short-link expansion; possibly `brand.controller.js`/listing-config returning signal).
- Roles: brand (restaurant owner). No follower/admin change.

## Data / contracts
- New/changed tables: **none** (no migration). Reuses PATCH `/brands/me`, POST/GET/PATCH
  `/brands/me/products`, GET `/brands/me/listing-config`, POST `/internal/geocode-maps-url`.
- Endpoints: geocode endpoint gains short-link handling; listing-config may expose an
  explicit `is_profile_complete`/returning flag (cleaner than client heuristic).
- Money/units/attribution: none changed.

## Non-functional
- Auth/role gates: unchanged (`requireRole('brand')`).
- Failure modes: short-link expansion must time out fast + degrade to today's "paste full
  URL" message on failure (never hang the wizard); profile-section saves are independent
  (one failing section never blocks another); first-time wizard path untouched for safety.
- Gate: `pnpm qa` green; UI-governed → mockup-lock + `06-diff/notes.md`; brand-web deploy
  via Vercel (production-impacting) surfaced for explicit go.
