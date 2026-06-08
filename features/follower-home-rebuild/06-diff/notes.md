# Before / After — follower-home-rebuild (Phase 1)

> Step 13 (UI-governed gate). "Before" = the locked mockup
> `design/wave4-creator-vibe/home-comprehensive.html` (phone panel). "After" = the
> real Home build (Maestro/APK screenshot, founder-side per
> `04-preview/mockups/home.maestro-flow.json`). This note records what shipped, the
> mockup match, and honest divergences.

## What shipped (2 files)
- `screens/follower/HomeScreenV2.js` — header rebuilt (location block + bell icon +
  round **profile avatar** showing the real user initial → Profile tab); **serif
  greeting** "Hey, what's good today?" + tagline; **search bar with brown filter
  button**; fallback CategoryGrid **Eat re-pointed** to `CategoryList`.
- `components/SectionRenderer.js` — every shelf now renders via the Phase-0
  `components/vibe` kit (StoryRail, CategoryRail, ShelfBrandCard, ShelfProductCard,
  DealCard, FeatureCard, ShelfHeader); **Eat/dining re-pointed** to `CategoryList`
  (was DiningHome); offers hero/grid + controls variants preserved for later phases;
  `hasEngineContent` unchanged; product taps now carry the product object + 4-ID.

## Matches the mockup (home-comprehensive.html phone panel)
- Header: location "📍 DISCOVER IN · Vijayawada ▾", round bell, round profile
  avatar. Greeting (serif) + tagline. Search + filter button.
- Stories: coral→amber gradient-ring round avatars, @handle, ● LIVE.
- Browse by Category: round rounded-square emoji tiles (replacing square grid).
- Top Eats (BRANDS) → serif shelf header + image-hero brand cards.
- Trending Dishes (PRODUCTS) → image-hero product cards, ₹price.
- Eat → the agreed Category screen (not DiningHome).

## Honest divergences (intentional)
1. **Gradients approximated** via the OTA-safe `Gradient` primitive (Phase 0
   decision; bare RN 0.73.6, OTA-only). Banding visible on close inspection.
2. **Brand cards omit ★rating + distance** — no backing field in `mapBrandItem`
   (backend-first). Re-added when reviews/geo are wired.
3. **No notification count on the bell** — no unread-count endpoint exists; not
   fabricated. Bell is an icon button (parity with the prior Home).
4. **Offer shelves empty** — What's Hot / Best Deals / Because-You-Follow /
   Biggest-Discounts / Ending-Soon / Top-Picks are offer-gated and offers are empty
   platform-wide (offer-source gap, fixed in Phase 3). They render nothing (no fake
   deals). Visible Home today = header + greeting + search + Stories + Categories +
   Top Eats (brands) + Trending Dishes (products) — matching the verified live
   payload (3 brands + 8 dishes + 7 tiles).
5. **Shared SectionRenderer** also upgrades the cards on Category/Offers/Creator/
   SchemaDetail screens (consistent). Their bespoke chrome (sticky chips, hero, full
   list, collabs, ranking) is refined in their own later phases. No nav target
   changed except the intentional Eat re-point.

## Verification
- Babel transform via `module:@react-native/babel-preset`: **2/2 PASS**.
- `pnpm qa`: **GREEN — 79 passed, C1 GREEN** (`qa/reports/2026-06-08T05-20-53-343Z/`).
  Note: a prior run showed 6 transient failures in the `B1b W4 admin-auth
  invariants` (backend session/warmup state) — environmental, NOT from this
  mobile-only change (it cannot touch admin-API auth); deterministic GREEN on
  re-run confirms zero regression. Classified as environmental flake (failure
  taxonomy §6.1), not a genuine defect.
- Eat re-point: no `DiningHome` navigate remains in the Home/SectionRenderer
  category handlers (only comments).

## Release
**production-impacting** (follower OTA). `released` stays false until explicit
founder go + Maestro attest (or recorded `GOVERNANCE_OVERRIDE`). OTA:
`pnpm publish-ota:follower` (follower OTA v68 → next).
