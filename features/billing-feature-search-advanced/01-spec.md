# billing-feature-search-advanced — Phase A12.3

> Second per-feature enforcement following A12.2. Boolean gate on
> "advanced" influencer-search filter params — tier (influencer band)
> and min_er (engagement-rate threshold). Brands whose plan doesn't
> include the feature get a 422 FEATURE_NOT_AVAILABLE the moment they
> pass any blocked param. Basic filters (q, niche, city, gender) stay
> open to every tier.

## What ships

**Backend — gate helper**
- `_requireAdvancedSearchFilters(brandId, query)` in `campaign.controller.js`.
- Detects advanced params present in `req.query` (`tier`, `tiers`, `min_er`).
- If brand has the feature OR no advanced params used → no-op.
- Otherwise throws 422 `FEATURE_NOT_AVAILABLE` with structured payload `{feature_key, blocked_params, upgrade_to}`.

**Wired into**
- `GET /v1/campaigns/:id/influencer-search` — gate fires before the existing where-clause build.
- `GET /v1/campaigns/:id/sets/:sid/open-group-matches` — same.

**Defensive fail-open**
- Feature not enforced (`is_enforced=false`) → `hasFeature` returns true → gate is a no-op. Same posture as A12.2's discover_filter.
- Brand has feature → gate is a no-op.
- No advanced params in the query → gate is a no-op.

**Migration M064**
- `UPDATE features SET is_enforced=true WHERE feature_key='search_filters_advanced'`.
- Idempotent. Same flip pattern as M062/M063.

## Tier defaults (already seeded by M061)
- Free: NOT included → 422 if tier/min_er used.
- Growth / Pro / Enterprise: included → free to use advanced filters.

Admin can flip any tier's included flag in `/admin/pricing/tiers/[tier_key]` Section C; change takes effect within 60s entitlements cache.

## Out of scope
- Frontend "hide the advanced filter UI" for tiers without the feature. Backend gate is the source of truth; UI hiding is a polish task that can ship later via a `useFeatureCheck` hook + the existing QuotaWallModal pattern.
- Other features in the catalog (bulk_outreach, open_group_broadcast, etc.) — A12.4+ each own contract.

## Files
- `backend/src/controllers/campaign.controller.js` — `_requireAdvancedSearchFilters` helper + 2 endpoint hooks.
- `backend/migrations/064_enforce_search_filters_advanced.sql` + `backend/scripts/run-064.js`.
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING — Render redeploys backend; M064 needs separate explicit founder go.
- Backward compatible: pre-M064 the gate is a no-op even with all code deployed. API JSON shape unchanged on success; new 422 envelope on block.
