# Before / After — follower-category-rebuild (Phase 2)

> Step 13 (UI-governed gate). "Before" = `category-comprehensive.html` (Eat phone
> panel). "After" = the real Category build (Maestro/APK screenshot, founder-side
> per `04-preview/mockups/category.maestro-flow.json`).

## What shipped (5 files)
- `screens/follower/CategoryListScreen.js` — compact header (back · "🍽️ Eat" +
  "📍 Vijayawada · N places" · search icon); **sticky sub-category bar** populated
  from the real sub-types present in the payload; client-side sub-cat **filtering**
  of the brand/product shelves; the empty `subcat_chips` shelf is suppressed (the
  screen renders the real bar); removed the old big search bar + duplicate top
  sort-pills. Restructured to a fixed header+sub-bar over a scroll body.
- `components/SectionRenderer.js` — `brands` shelf with `config.main_list` →
  full-width **list** of `ShelfBrandListRow` (was a rail).
- `components/vibe/ShelfBrandListRow.js` — NEW full-width brand row (thumb + name +
  cuisine/category + city).
- `components/vibe/index.js` — export `ShelfBrandListRow`.
- `components/vibe/StoryCircle.js` — additive follower-count line (Category creator
  circles); Home stories still show ● LIVE.

## Matches the mockup (category-comprehensive.html Eat panel)
- Compact header (back · icon+label + place count · search icon).
- Sticky sub-cat chip bar ("All" + sub-types), active chip = brown.
- Top Creators (gradient-ring circles with follower counts), Popular Businesses
  (brand rail), Trending Items (product rail), Best Deals (deal rail), Filter bar
  (chips), All Businesses (full-width list-rows).

## Honest divergences (intentional)
1. **Sub-cat chips = REAL sub-types present** (e.g. Restaurants, Bakery for dining),
   not the mockup's fixed Restaurants/Cafes/Street-Food/Bakery — the finer types
   need the frozen drill-down taxonomy (roadmap #2). A chip shows only if such
   listings exist. Tapping filters the brand/product shelves + All list client-side.
2. **Filter bar is display-only** (Relevance/Offers/Nearest/Top Rated) — functional
   sort across engine shelves is a later polish.
3. **Best Deals empty** (offer-source gap, Phase 3) → renders nothing.
4. **Brand list-rows omit ★rating + reviews + distance + per-row offer/creator** —
   none are in the brand item shape (backend-first). Return when wired.
5. Gradients approximated (Phase-0 OTA-safe primitive).

## Verification
- Babel transform via `module:@react-native/babel-preset`: **5/5 PASS**.
- `pnpm qa`: **GREEN — 79 passed, C1 GREEN** (`qa/reports/2026-06-08T05-44-29-226Z/`).
  Mobile-only change → web/api suite unaffected = zero regression.
- Additive component changes (new `main_list` branch / new list-row / optional
  story line) → Home + other engine screens unaffected.

## Release
**production-impacting** (follower OTA). `released` stays false until explicit
founder go + Maestro attest (or recorded `GOVERNANCE_OVERRIDE`). OTA:
`pnpm publish-ota:follower` (follower OTA v69 → next).
