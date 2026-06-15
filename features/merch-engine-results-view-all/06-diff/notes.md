# 06-diff notes — Results page + universal "View all"

Implemented to the locked mockup (`04-preview/mockups/results-view-all.html`).

## What was implemented
- **Backend**: `GET /v1/follower/section-results` (`getSectionResults`) — generic; builds ctx
  from `rule` + `library_section_id` (→ ruleDef via sectionLibrary.getRuleJson) + surface
  context (`category_key`→categoryCats, `creator_handle`→influencer, `brand_id`, lat/lng) and
  runs `runRule(rule, ctx)` with limit = min(req.limit||60, 100). Returns `{ items, item_type, capped }`.
  authenticateOptional. Route added in follower.routes.js.
- **Mobile**:
  - `SectionResultsScreen` (new) — header (title + back) + **2-column grid** for products,
    vertical list for offers (DealCard) / brands (ShelfBrandListRow) / creators (rows). Empty +
    "first 100" states. Registered as `SectionResults` in FollowerNavigator SHARED_SCREENS
    (unique name — no collision, no duplicate-name native crash).
  - `followerApi.getSectionResults(...)`.
  - `SectionRenderer`: accepts a `context` prop; wires `onSeeAll` (already rendered by
    ShelfHeader) on product/offer/brand/creator shelves → navigate `SectionResults` with
    `{ title, rule, config.library_section_id, item_type, + context }`. Exported goToProduct/
    goToOffer/goToBrand for reuse by the Results screen.
  - Host screens thread context: HomeScreenV2 (lat/lng), CategoryListScreen (superCategory + lat/lng).

## Verified
- backend `node --check` (controller + routes); `pnpm qa` 79/79 GREEN gate 0.
- **section-results core validated read-only against real prod**: products_in_category(fashion)=7,
  businesses_in_category(food)=3, top_picks=9, creators_listing=2 — all at limit 100, no errors.

## Mockup → build: matches
- "See all →" on every list-bearing shelf; shared Results screen; 2-col products / list others;
  context carried (creator/category). v1 capped at 100 (note shown). Palette = current vibe kit
  (gold/cream re-skin is Phase 5).

## Diverged (intentional)
- Products rendered with a self-contained 2-col card (controlled grid width) rather than the
  rail ShelfProductCard, to guarantee clean 2-column layout. Offers/brands reuse existing cards.

## What to check in prod (founder)
- Tap "See all →" on a product shelf → 2-col full list; on a creator store shelf → only that
  creator's items; on a category screen → only that category. Back works.
