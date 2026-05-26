# Workflow — billing-feature-search-advanced (A12.3)

## Actor
Brand using the influencer search or open-group match endpoints during campaign creation.

## Preconditions
- A10/A12.1/A12.2 shipped.
- M064 applied (is_enforced=true on search_filters_advanced).
- Free tier's tier_features row for search_filters_advanced has included=false (default seed).

## Workflow A — Free brand uses only basic filters
1. Brand on Free calls `GET /campaigns/:id/influencer-search?q=foo&niche=fashion&city=Vijayawada`.
2. `_requireAdvancedSearchFilters` checks query → no advanced params → returns immediately.
3. Search proceeds normally.

## Workflow B — Free brand tries advanced filter
1. Brand on Free calls `GET /campaigns/:id/influencer-search?q=foo&tier=micro&min_er=2.5`.
2. `_requireAdvancedSearchFilters` sees `tier` + `min_er` in query.
3. `entitlementsService.hasFeature(brandId, 'search_filters_advanced')` → false (Free tier doesn't include it).
4. Backend throws 422 `FEATURE_NOT_AVAILABLE` with payload `{feature_key: 'search_filters_advanced', blocked_params: ['tier','min_er'], upgrade_to: ['growth','pro','enterprise']}`.
5. Frontend can render upgrade modal or hide the filters preemptively.

## Workflow C — Growth brand uses advanced filters
1. Brand on Growth calls `GET /campaigns/:id/influencer-search?q=foo&tier=micro&min_er=2.5`.
2. hasFeature → true (Growth includes it per M061 seed).
3. Gate returns immediately.
4. Search proceeds with the advanced filters applied.

## Workflow D — admin flips a tier's flag
1. Admin opens `/admin/pricing/tiers/free` Section C.
2. Toggles search_filters_advanced "Included" checkbox to ON.
3. Saves.
4. Within 60s (entitlements cache), Free brands can use advanced filters.

## Success
- pnpm qa GREEN.
- Free brand using advanced filters → 422 FEATURE_NOT_AVAILABLE.
- Growth+/Pro+/Enterprise+ brands continue to use advanced filters freely.
- Admin toggle takes effect within 60s.

## Failure modes
- Feature not yet enforced (M064 not run) → hasFeature returns true → no-op gate. Pre-M064 deploy is behaviour-inert.
- Brand has no tier_features row for search_filters_advanced → `included=false` per the entitlements service default → blocked. Defensive but admin can fix by adding the row in Section C.
- Query string passes `tier` as empty string → not counted as "used" (filter checks `v != null && v !== ''`).
