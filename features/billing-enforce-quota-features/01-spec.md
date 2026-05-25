# billing-enforce-quota-features — Phase A12.1

> Migrates the 4 already-enforced quota gates from reading the legacy
> `subscription_tiers.max_*` columns to reading the new
> `tier_features.quota_value` entitlements. Closes the gap the founder
> caught — Section C edits in `/admin/pricing/tiers/[tier_key]` now
> actually drive runtime enforcement.

## Bug closed

Before A12.1:
- Admin edits "Active campaigns" quota for Free tier from 1 → 2 in Section C of the tier editor.
- That writes to `tier_features.quota_value` (the new entitlements table).
- The quotaCheck middleware (Phase A4) reads `subscription_tiers.max_campaigns` (legacy column from M058 seed = 1).
- Brand on Free with 1 campaign creates a 2nd → blocked unfairly OR brand on Growth with default 3 creates a 4th → allowed even when admin set the entitlement to 2.
- Founder's "Aveen food paradise" with 2 campaigns + admin-set limit=2 saw the create flow open with no popup, exactly because of this disconnect.

After A12.1:
- Middleware calls `entitlements.service.quotaFor(brandId, 'active_campaigns')` which reads `tier_features.quota_value` (the same table admin edits).
- Whatever admin sets in Section C drives the gate immediately (60-second cache TTL per the existing entitlements service).
- Upgrade-to query also reads `tier_features`, so the popup's "View plans" suggestions match what admin actually configured.

## What ships

**Refactored `backend/src/middleware/quotaCheck.js`**
- ACTIONS registry maps each action to a `feature_key` (instead of `limitField`).
- `checkQuota(action)` calls `entitlementsService.quotaFor(db, brandId, cfg.feature_key)` for the limit.
- `_ensureSubscription` simplified — no longer loads legacy max_* columns into memory; only returns identity (tier_id, tier_key, cycle dates).
- New `_findUpgradeTiers(featureKey, currentTierKey, currentLimit)` joins `subscription_tiers + tier_features + features` to return tier_keys offering more for the same feature.
- QUOTA_EXCEEDED payload now also includes `feature_key` alongside `action` (back-compat: existing consumers ignoring unknown fields keep working).

**Migration 062** (`backend/migrations/062_enforce_quota_features.sql`)
- `UPDATE features SET is_enforced = true WHERE feature_key IN (active_campaigns, sets_per_campaign, products_in_store, invitations_per_cycle)`.
- Idempotent. Catalog admin UI now shows the "✓ ENFORCED" badge on these 4 rows so admin sees what's gated vs display-only.

**Test update** (`backend/tests/quotaCheck.test.js`)
- `beforeEach` extended to seed `tier_features` rows after the subscription_tiers reset (the DELETE cascades through tier_features otherwise; refactored middleware then reads empty entitlements + falls through).
- Seed values copy the legacy max_* columns into corresponding tier_features.quota_value for the 4 quota features — so existing assertions (limit=10 products on free, etc.) continue to hold against the new code path.

## Files
- `backend/src/middleware/quotaCheck.js` — full rewrite (~120 lines, simpler than before).
- `backend/migrations/062_enforce_quota_features.sql` — new (small UPDATE).
- `backend/scripts/run-062.js` — new (sanity probe).
- `backend/tests/quotaCheck.test.js` — `beforeEach` extended.
- This contract.

## Out of scope
- New gates for the 7 not-yet-enforced features (discover_filter, search_filters_advanced, bulk_outreach, open_group_broadcast, multi_branch_support, dedicated_onboarding_call, phone_support_24x7) — A12.2 onward, founder-paced.
- Razorpay live (A13).
- Per-brand override (A14).
- Memory roadmap update (housekeeping).

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING — Render redeploys backend with the new middleware. M062 needs separate explicit founder go on prod (same pattern as M061).
- Backward compat: legacy `subscription_tiers.max_*` columns stay in the schema (other code paths like the brand subscription page's current-plan card still read them as display-only). Nothing else relies on them as a runtime gate now.
- API surface: QUOTA_EXCEEDED response shape is additive (new `feature_key` field). All existing clients keep working.
