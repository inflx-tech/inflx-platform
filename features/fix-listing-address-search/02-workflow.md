# Workflow Definition — Fixes: redundant address + search ranking

## Actor
Restaurant owner (brand), registering + listing.

## Preconditions
A restaurant that registered with an address (lat/lng/locality stored).

## Workflow steps (observable)
1. Owner finishes registration (address captured).
2. Owner opens the listing wizard → the **Location step is NOT shown** (already
   have it). Other steps (Basics, Hours, Dining, Menu…) render normally.
3. If the owner clicks "Edit business profile", ALL steps incl. Location show so
   they can change the address.
4. In the dish typeahead, typing "upma" → **"Upma" appears first**, before
   "Rava Upma" and any custom suggestion.

## Success definition
- New-restaurant first listing does not re-ask the address when registration
  captured it.
- `GET /brands/me/listing-config` returns lat/lng/locality/formatted_address.
- `searchMasterDishes('upma')` returns "Upma" as the first result.

## Failure / edge workflows
- Brand with NO stored location (edge) → Location step still shows (first
  capture) — not skipped.
- Edit-setup mode → Location step always shown.
