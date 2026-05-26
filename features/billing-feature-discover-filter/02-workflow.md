# Workflow — billing-feature-discover-filter (A12.2)

## Actor
Brand creating/editing a campaign, using the influencer search or open-group match endpoints.

## Preconditions
- A10/A12.1 shipped; tier_features populated; admin has configured discover_filter for each tier in Section C.
- M063 applied (is_enforced=true on discover_filter).
- Brand's user record has city + state filled.

## Workflow A — Free tier search (city scope)
1. Admin sets Free tier discover_filter to `{area_scope: 'city', niches_limit: 3}`.
2. Brand "Aveen Restaurant" in Vijayawada on Free tier opens campaign builder.
3. Calls `GET /campaigns/:id/influencer-search?q=foo`.
4. Backend: `_applyDiscoverFilter` reads config → area_scope='city' → joins users for brand → city='Vijayawada' → adds `i.city = 'Vijayawada'` to WHERE.
5. Response only includes influencers based in Vijayawada.
6. Response envelope: `discover_filter: { area_scope: 'city' }` so frontend can show "Showing influencers in your city (Free plan)".

## Workflow B — Growth tier search (state scope)
1. Admin sets Growth tier discover_filter to `{area_scope: 'state', niches_limit: 10}`.
2. Brand on Growth in Vijayawada (state Andhra Pradesh) searches.
3. `i.state = 'Andhra Pradesh'` injected. Response includes influencers across AP.

## Workflow C — Pro/Enterprise (all_india)
1. Admin sets Pro/Enterprise to `{area_scope: 'all_india'}`.
2. No filter added — brand sees the full influencer pool.

## Workflow D — Open-group broadcast with niches array
1. Free brand calls `GET /campaigns/:id/sets/:sid/open-group-matches?niches=fashion,beauty,food,fitness`.
2. niches.length = 4. Free niches_limit = 3.
3. Backend throws 422 `FEATURE_LIMIT` with `{feature_key:'discover_filter', config_key:'niches_limit', used:4, limit:3}`.
4. Frontend can show upgrade prompt similar to QuotaWallModal.

## Workflow E — Brand with no city/state
1. Brand registered without city/state (legacy data).
2. `_applyDiscoverFilter` finds no city/state → skips area filter → brand sees full pool.
3. Defensive: doesn't lock brand out due to data quality.

## Success
- pnpm qa GREEN.
- Brand on Free with city='Vijayawada' searching returns only Vijayawada influencers.
- Brand on Growth returns state-wide.
- Brand on Pro/Enterprise returns India-wide.
- Open-group with too many niches → 422.

## Failure modes
- Brand has city but admin-set area_scope is 'state' AND brand has no state → defensive: no filter.
- Influencers table has city but state column NULL on some rows → state filter excludes those rows. Not great. Acceptable for A12.2; admin can backfill via a separate ops task.
- Two brands with the same user_id (impossible by schema) → would share the area filter. N/A.
