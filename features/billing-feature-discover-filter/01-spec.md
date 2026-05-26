# billing-feature-discover-filter — Phase A12.2

> First per-feature enforcement contract following A12.1. Wires the
> `discover_filter` config feature into the influencer search +
> open-group match endpoints so admin's tier-level `area_scope` and
> `niches_limit` settings actually shape what each brand sees.

## What ships

**Backend — entitlements service helper**
- `entitlements.service.configFor(client, brandId, feature_key)` returns the tier_features.config jsonb (or `{}` when feature not enforced / no row).
- Honours `is_enforced` flag for defensive pass-through.

**Backend — discover_filter wiring in `campaign.controller.js`**
- New `_applyDiscoverFilter(brandId, paramStartIdx)` helper reads brand's user.city/state + tier config; returns SQL fragments to inject.
- `searchInfluencers` (GET `/campaigns/:id/influencer-search`) — injects the area_scope filter alongside existing where clauses.
- `openGroupMatches` (GET `/campaigns/:id/sets/:sid/open-group-matches`) — injects area_scope + validates `niches_limit` array cap; throws 422 `FEATURE_LIMIT` if request exceeds the tier's niches_limit.

**Migration M063**
- Single-row UPDATE: `is_enforced = true` on `discover_filter`. Idempotent.
- Catalog page enforcement badge now reads "yes" for this feature.

**Tier config semantics**
- `area_scope: 'city'` → brand sees only influencers in brand's city (`i.city = users.city`).
- `area_scope: 'state'` → brand sees only influencers in brand's state (`i.state = users.state`).
- `area_scope: 'all_india'` → no filter.
- `niches_limit: N` → max distinct niches per open-group broadcast (only enforced on openGroupMatches; searchInfluencers takes single niche so it's not applicable).
- `niches_limit: -1` → unlimited.

**Defensive pass-through (all fail-open)**
- Feature not enforced → no filter.
- Brand has no users.city/users.state → no filter (don't lock brand out of their own data).
- No tier_features row OR no config blob → no filter.
- Unknown area_scope value → no filter.

## Out of scope
- Frontend hints (e.g. UI greying-out the niche picker for tier limits). Optional polish; can ship later.
- The single-niche `niche=foo` query param on searchInfluencers — does not consume the niches_limit; the limit only applies where the brand picks multiple niches at once (open-group).
- Other features in the catalog (search_filters_advanced, bulk_outreach, etc.) — A12.3+ each own contract.

## Files
- `backend/src/services/entitlements.service.js` — `configFor` helper.
- `backend/src/controllers/campaign.controller.js` — `_applyDiscoverFilter` + 2 endpoints wired.
- `backend/migrations/063_enforce_discover_filter.sql` + `backend/scripts/run-063.js`.
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING — Render redeploys backend; M063 needs separate explicit founder go on prod.
- Backward compatible: defensive fail-open means no brand workflow breaks. Response envelope adds `discover_filter` metadata as additive field.
- API JSON shape additive (existing consumers ignore new `discover_filter` field).
