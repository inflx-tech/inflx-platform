# Feature Spec — Results page + universal "View all"

> The shared full-list screen reachable from every shelf — and the doorway the Phase-6
> banner-gateway + hero-tiles will reuse. UI-governed + Mobile (OTA) + backend. No migration.

## Problem / goal
Every shelf today shows a LIMITED set with no way to see the rest — a dead-end. **Goal:** a
universal **"View all"** on each shelf (and tapping the title) that opens ONE shared **Results
screen** = run that shelf's rule → the **full list** (2-column for products), with the SAME
surface context stacked (creator/brand/category/city). This same screen is the future target
for banner-gateway CTAs + hero tiles (Phase 6) — build once, reuse three ways.

## Scope
- **In scope:**
  - **Backend** `GET /v1/follower/section-results` (generic): params `rule`, `library_section_id?`,
    `category_key?`, `creator_handle?`, `brand_id?`, `lat/lng?`, `limit?`. Builds ctx (ruleDef
    from library_section_id, categoryCats from category_key, influencer from creator_handle,
    brandId) and calls `runRule(rule, ctx)` with a larger limit (default 60, cap 100). Returns
    `{ items, item_type }`. `authenticateOptional` (public discovery).
  - **Mobile**:
    - `SectionResultsScreen` (new, registered as `SectionResults` in FollowerNavigator
      SHARED_SCREENS): header (title + back) + full list — **2-column grid for products**
      (ShelfProductCard), vertical list for offers/brands/creators (reusing DealCard /
      ShelfBrandListRow / StoryRail rows). Taps carry the same tracking/nav as in-shelf.
    - `followerApi.getSectionResults(...)`.
    - `SectionRenderer`: thread surface-context props (screenType, superCategory, creatorHandle,
      brandId, lat/lng); wire `onSeeAll` on product/offer/brand/creator shelves → navigate to
      `SectionResults` with `{ title, rule, config, item_type, context }`. Tapping the title = same.
    - Host screens pass their context to `<SectionRenderer>`: HomeScreenV2 (lat/lng),
      CategoryListScreen (superCategory + lat/lng), creator/offers section screens (handle).
- **Explicitly out of scope:**
  - True offset pagination / infinite scroll → **v1 is a capped list (≤100)**; "load more" is a
    documented fast-follow (rules have no OFFSET today).
  - "View all" on nav-tiles / controls / collection-header shelves (not list-bearing).
  - Banner-gateway + hero-tiles presentation (Phase 6 — they'll reuse this screen).
  - Migration (none).

## Surfaces touched
- Backend (1 route + controller) + mobile (1 new screen + SectionRenderer wiring + host context
  + api.js + navigator). No brand-web, no migration.
- Roles: follower (public discovery).

## Data / contracts
- New `GET /v1/follower/section-results` → `{ items: [...], item_type }`. Reuses `runRule` +
  `sectionEngine.resolveInfluencerByHandle` + `categoryTaxonomy` + `sectionLibrary.getRuleJson`.
- No new tables/columns. The app passes each shelf's existing `rule` + `config`
  (`config.library_section_id`) + the host surface context.

## Non-functional
- **Context stacking**: the Results screen re-runs the rule with the SAME context → a creator-
  store "View all" shows only that creator's matches (Layer 6 preserved).
- **Failure modes**: unknown rule → [] (graceful); empty → friendly empty state; capped at 100
  (note shown if hit). Read-only; parameterized.
- **Deploy**: backend (Render) + mobile (OTA). released=false until founder verifies. No Maestro
  (not flipping released). UI-governed → mockup-lock + 06-diff.
