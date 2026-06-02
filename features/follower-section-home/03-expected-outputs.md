# Expected Outputs — Follower Home on the Section Engine (Phase C)

## Foundation commit (inert)
- `config/featureFlags.js` exports `SECTION_ENGINE_HOME === false`.
- `followerApi.getHomeSections(loc)` issues `GET /follower/home` with city/lat/lng.
- `components/SectionRenderer.js` exports a component that, given
  `{ sections }`, renders:
  - `creators` → `InfluencerStoryRow`
  - `nav_tiles` → `CategoryGrid`
  - `offers` / `mixed` → horizontal `NewOfferCard` rail
  - `products` → horizontal `ProductCard` rail
  - `brands` → horizontal brand rail (existing card)
  - `controls` / unknown → rendered as nothing (skipped) — never throws
  - each tappable item navigates with `item.tracking`.
- All touched Mobile files pass a babel transform.
- App behavior on devices is **unchanged** (flag off; SectionRenderer unimported
  by any screen until the wiring step).

## Wiring step (flag-gated, next)
- With `SECTION_ENGINE_HOME=true`, `HomeScreenV2` renders the shelves returned by
  `/home` in order (stories · browse_category · whats_hot · top_picks · top_in
  rails · biggest_discounts · deals_ending_soon), matching `home-comprehensive.html`.
- With the flag false, `HomeScreenV2` renders exactly as today.
- `/home` failure/empty → automatic fallback to the hardcoded path (no blank Home).

## Honest non-outputs
- No new card visuals (reuse current components).
- No Category/Offers/Creator wiring (Phase C2).
- No OTA in the foundation commit — nothing reaches devices until the gated cutover.
