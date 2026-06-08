# Workflow Prediction — follower-category-rebuild

> Step 6 (UI-governed). Reviewed before code.

## Locked mockup (source of truth)
`design/wave4-creator-vibe/category-comprehensive.html` — the three Category
screens (Eat · Shop · Groom phone panels) + the Admin Section Manager. The build
matches the phone panel for the active vertical. Canonical, founder-iterated
(NEXT-WINDOW-PROMPT §0.3); not duplicated here.

## What the reviewer should see (mockup → build)
- **Header:** back · "🍽️ Eat" + "📍 Vijayawada · N places" · search icon. Build: same.
- **Sticky sub-cat bar:** All · Restaurants · Cafes · Street Food · Bakery. Build:
  "All" + the **real sub-types present** in the live payload (e.g. Restaurants,
  Bakery for dining) — derived from the brand shelves' `brand.category`; tapping
  filters. (Cafes/Street Food appear only when such listings exist — honest.)
- **Shelves:** Top Creators (gradient-ring circles w/ follower counts), Popular
  Businesses (brand rail), Trending Items (product rail), Best Deals (deal rail),
  Filter bar (chips), **All Businesses (full-width list)**.

## Honest divergences (intentional)
- **Sub-cat chips = real sub-types**, not the mockup's fixed Restaurants/Cafes/
  Street-Food/Bakery — those finer types need the drill-down taxonomy (frozen). The
  interim shows the true child schema-keys with live listings.
- **Filter bar is display-only** (Relevance/Offers/Nearest/Top Rated) — sort wiring
  across engine shelves is a later polish.
- **Best Deals empty** (offer-source gap, Phase 3) → renders nothing.
- **Brand list-rows omit ★rating + distance** (no backing field; backend-first).
- Gradients approximated (Phase-0 OTA-safe primitive).

## After-capture
Mobile "after" = a Maestro/APK screenshot of the Eat Category screen (founder-side),
per `category.maestro-flow.json`. Founder smoke if emulator unavailable; record
honestly (+ `GOVERNANCE_OVERRIDE` if flipping released without an automated run).

## Review signal
Founder green (delegated) = mockup-lock; then implement.
