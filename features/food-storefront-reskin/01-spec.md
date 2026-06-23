# 01 — Spec · Food storefront reskin (menu-forward, toing)

Reskin RestaurantDetailScreen to the toing palette AND restructure it to be
menu-forward (the menu IS the screen, not buried behind an Overview tab).
Founder approved the inline mockup ("this is ok"). Mobile-only OTA, no backend.

## Scope
- Repoint the `lightColors` shim creatorVibe→toing; fix hardcoded C.brown/C.ink.
- Menu = primary scroll content: search + veg filter + collapsible categories,
  always visible. Overview/Offers/Reviews/Photos demoted to a compact secondary
  strip below the menu.
- Header: green rating pill, ETA+distance, free-delivery + open badges, offer
  strip (pink → cart).
- Green ADD on menu rows + green cart bar.
- Keep creator-collab + Sagar's Table strips (reskinned).

## Out of scope
- Backend (all fields already supplied). Other verticals' storefront (shared
  pattern carries later). Maestro (no device).
