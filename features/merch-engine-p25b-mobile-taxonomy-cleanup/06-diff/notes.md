# 06-diff notes — Phase 2.5b (mobile taxonomy cleanup)

No new visual design was authored (founder deferred the one visually-changing screen,
FindScreen, to Phase 5). This records the before/after of the implemented changes in words.

## What was implemented
1. **Brand signup value** — `BrandRegisterScreen.js` (mobile) + `login/page.js` (web):
   the "Fashion & Apparel" option now saves `value: 'fashion'` (was `fashion_walkin`).
   On-screen label unchanged.
2. **Food tile layout** — `CategoryListScreen.js`: `isDining` now includes the `food`
   launch-tile key (was only `eat`/`dining`).
3. **Offline fallback + tint** — `CategoryGrid.js`: `DEFAULT_CATEGORIES` → the 5 launch
   tiles; `SUPERCAT_ACCENT` gained the new tile keys (legacy keys kept for back-compat).

## Before → after (behavioural)
- **Signup:** before → new fashion brand stored as `fashion_walkin` (alias-mapped at read
  time). After → stored as `fashion` directly. No screen change.
- **Food tile:** before → tapping Food (new key `food`) fell through to the product-grid
  (Shopping) layout. After → Food renders the existing restaurant/dining layout, identical
  to the proven Eat-path layout (restaurant cards, cuisine chips, deal badges).
- **Offline Home grid:** before → 5 server tiles when online, but the *fallback* (API down)
  showed the old 7 verticals incl. empty ones. After → fallback shows the 5 launch tiles.

## What matches / what diverged
- Matches the 2.5a backend truth (5 tiles, fashion merged) end-to-end on the client.
- Diverged from a "full mockup" cycle intentionally: no new design exists to mock; the
  Food layout reuses an already-shipped screen. Recorded here per gov-check Rule 4.

## What to check in prod (founder)
- New fashion signup → brand `category=fashion`.
- Tap **Food** → restaurant/dining layout with the food businesses.
- Other tiles unaffected; creator/brand stores unaffected.
