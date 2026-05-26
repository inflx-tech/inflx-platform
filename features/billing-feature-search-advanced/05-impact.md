# Impact — billing-feature-search-advanced (A12.3)

## Changes
- 1 helper added (`_requireAdvancedSearchFilters` in campaign.controller).
- 2 endpoint call sites added (1 line each at start of searchInfluencers + openGroupMatches).
- 1 migration (M064) flips is_enforced=true.
- 1 runner script.
- 1 contract folder.

## Blast radius
- Affects 2 endpoints only.
- Behaviour change after deploy + M064: Free-tier brands trying to filter by `tier` or `min_er` get 422; Growth+ unaffected.
- Catalog tier defaults from M061 already align: Free excluded, Growth+ included. Admin can re-tune per tier.

## Rollback
Revert commit + revert M064 (`UPDATE features SET is_enforced=false WHERE feature_key='search_filters_advanced'`). All searches return to ungated behaviour immediately.

## Risks
- **Frontend may still send `tier` or `min_er` for Free brands** if the filter inputs are visible. Brand sees 422 → may be confusing without UI hiding. Mitigation: short-term, the QuotaWallModal can be extended to recognise FEATURE_NOT_AVAILABLE; longer-term, hide the filter inputs for tiers without the feature.
- **Empty-string param edge case** — the helper treats `tier=''` and `min_er=''` as "not used" (frontend might send empty defaults). Acceptable; only non-empty values trigger the gate.
- **Brand has no tier_features row** for search_filters_advanced → defensive default is `included=false` → blocked. Admin should ensure the row exists for all tiers (M061 seeded all of them).

## Pre-push checklist
1. pnpm qa main GREEN.
2. Backend boot smoke clean.
3. M064 applied locally + sanity probe shows is_enforced=true.
4. gov-check exit 0 (Rules 1+3+4).
5. M064 prod run gated on separate explicit founder go after push.
