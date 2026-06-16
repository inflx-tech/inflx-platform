# 01 — Spec: Follower rebuild — Category screen

**Contract:** `follower-rebuild-category` · shopping-journey sequence step 1.
**Locked reference:** founder's `CREATORS VIBE Yellow -standalone- (1).html` (screen 11
Categories + the card/appbar system) → authored into `04-preview/mockups/category.html`.
**Founder:** 'ok lock it' 2026-06-16.

## Finding (verify-first)
The Category **detail** screen (`CategoryListScreen`) was already rebuilt in Phase 5:
section-driven (sub-category circles + `SectionRenderer` shelves), gold/cream palette,
"View all" headers, product cards with struck MRP. It already matches mockup **B**
structurally + visually. The Creators Vibe Yellow gold (`#F4B40D`) vs our token gold
(`#F6B11E`) differ <1% — NOT worth a global token churn that would restyle every
shipped screen.

## Scope (focused, honest)
- **Sub-category circles** (`vibe/CategoryCircle`): match the source's circle —
  cream/beige fill with a GOLD RING when active (currently grey `#F1F1F1` fill →
  solid-gold when active). Ripples to Home's category row too (consistent — same
  component, same source).
- **All-Categories list (mockup A)**: represented by Home's existing 5-tile grid.
  No new dedicated screen is added (no nav entry exists; would be speculative). If
  the founder wants a standalone All-Categories list screen later, that's a small
  additive follow-up.
- **No cart icon in the category appbar** until the checkout flow exists (Phase 8) —
  an icon that navigates nowhere would be a dead control.

## Out of scope
Global token/font overhaul; checkout; the per-vertical shelf CONTENT (admin-placed).

## Acceptance
- Sub-category circles render cream + gold-ring-active on Category + Home.
- `pnpm qa` GREEN gate 0 (mobile change is inert to web/backend tests).
- released=false until founder verify on device.
