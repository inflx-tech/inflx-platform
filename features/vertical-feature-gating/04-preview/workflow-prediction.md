# Workflow prediction — Vertical feature-gating nav

Mockup: `mockups/nav-gating.html` (three nav states by vertical).

## Predicted behaviour once implemented
1. Dashboard layout fetches `GET /brands/me/schema` on mount and reads
   `schema.features`.
2. Nav renders `NAV.filter(item => !item.feature || features?.[item.feature] === true)`.
   - `Meals` carries `feature:'meals'` → visible only when features.meals===true (restaurant).
   - `Bookings` carries `feature:'booking'` → visible only when features.booking===true.
3. While `features===null` (pre-fetch), both gated items are hidden → a
   car-rental brand never flashes "Meals".
4. Universal items render identically to today for every vertical.

## Predicted divergence from mockup
- Real bar uses the live Tailwind chrome + active-route highlight logic;
  the mockup approximates colours/spacing. Item set + gating is the
  contract, not pixel spacing.
