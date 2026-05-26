# 06-diff — billing-feature-discover-filter (A12.2)

**Before:** admin could set `discover_filter` config per tier in Section C of `/admin/pricing/tiers/[tier_key]` (e.g. Free → `{area_scope:'city', niches_limit:3}`), but the backend ignored it. Every brand saw the same full influencer pool when searching during campaign creation. The feature row carried `is_enforced=false`, so it was effectively marketing copy on the brand subscription page with no code behind it.

**After:** the gate is live. When a brand on Free in Vijayawada hits `GET /campaigns/:id/influencer-search`, the backend reads their tier's discover_filter config, looks up the brand's city from `users.city`, and injects `i.city = 'Vijayawada'` into the WHERE clause. Only Vijayawada-based influencers come back. Brand on Growth in Andhra Pradesh gets `i.state = 'Andhra Pradesh'` — state-wide pool. Brand on Pro/Enterprise gets the full pool (area_scope='all_india', no filter added).

Same logic applies to `openGroupMatches`. Additionally, that endpoint validates the `niches[]` array against the tier's `niches_limit`. Free brand requesting `niches=fashion,beauty,food,fitness` (4 niches) when limit is 3 → 422 with structured `FEATURE_LIMIT` payload that the frontend can render in the QuotaWallModal pattern.

**Defensive design:** the gate is fail-open. If the feature isn't enforced (M063 not run), if the brand has no city/state in users (legacy data), or if there's no tier_features row for discover_filter on the brand's tier — the filter is skipped. No brand gets locked out of their own data due to missing config or incomplete profile.

**API additive:** response envelopes now include a `discover_filter` field telling the frontend what was applied (`{area_scope: 'city'}` or `{area_scope, niches_limit}`). Lets a future UI pass show "Showing influencers in your city — upgrade for state-wide" without another roundtrip. Existing consumers that ignore the field keep working.

**Same pattern as A12.1:** entitlements.service is the single source of truth; configFor honours is_enforced; M063 flips the flag so the catalog admin page shows the right enforcement badge. Per-feature contracts follow this template for A12.3 onward (search_filters_advanced, bulk_outreach, etc.).

**Verified locally:** entitlements.service.configFor returns the right shape; campaign.controller boots clean; M063 applied to dev DB; sanity probe shows discover_filter.is_enforced=true.
