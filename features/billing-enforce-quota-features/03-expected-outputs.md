# Expected Outputs — billing-enforce-quota-features (A12.1)

## Schema
- 4 rows in `features` table have `is_enforced = true`:
  active_campaigns, sets_per_campaign, products_in_store, invitations_per_cycle.

## Backend behaviour
- `checkQuota('createCampaign'|'createProduct'|'createSet'|'inviteInfluencer')` reads from `tier_features.quota_value` (via `entitlements.service.quotaFor`).
- `subscription_tiers.max_*` legacy columns no longer consulted at gate time.
- QUOTA_EXCEEDED response payload includes `feature_key` (new field) alongside existing `{action, used, limit, current_tier, upgrade_to}`.
- upgrade_to list reflects what admin actually configured in tier_features for each tier (not the M058 defaults).

## API JSON shape (QUOTA_EXCEEDED)
```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Limit reached on the free plan: active campaigns (2 / 2). Upgrade to continue.",
    "field": "createCampaign",
    "details": {
      "action": "createCampaign",
      "feature_key": "active_campaigns",
      "used": 2,
      "limit": 2,
      "current_tier": "free",
      "upgrade_to": ["growth", "pro", "enterprise"]
    }
  }
}
```

## Test results
- pnpm qa main 76/76 GREEN unchanged.
- pnpm qa:db quotaCheck tests pass against the new middleware (asserts limit values match the tier_features seed, not the legacy columns).
- M062 sanity probe shows all 4 quota features `is_enforced=true`.

## Deploy posture
PRODUCTION-IMPACTING:
- Render redeploys backend with new middleware. **No prod schema migration needed for the code to run** — entitlements service falls back to catalog defaults if a tier_features row is missing.
- M062 (the `is_enforced=true` UPDATE) runs separately against prod Supabase on explicit founder go (same trap+restore pattern as M061).
- No mobile change.
