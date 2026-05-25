# Workflow — billing-enforce-quota-features (A12.1)

## Actor
Brand user creating a campaign / set / product / invite from the brand-web UI.

## Preconditions
- A10/A10.5/A11 shipped (admin can edit tier_features quota_value in Section C of the tier editor).
- M061 applied (features catalog + tier_features seeded).
- M062 applied (is_enforced=true on 4 quota features).

## Workflow A — admin sets a quota
1. Admin opens `/admin/pricing/tiers/free` Section C.
2. Edits "Active campaigns" quota_value from 1 to 2.
3. Click Save → PUT `/admin/tiers/free/features` writes the row.

## Workflow B — brand on Free creates campaigns
1. Brand creates campaign #1 → POST `/v1/campaigns` → middleware runs.
2. Middleware: `_ensureSubscription` returns tier_key='free'. `quotaFor('active_campaigns')` reads tier_features → 2. counter returns 0. 0 < 2 → next().
3. Campaign #1 created.
4. Brand creates campaign #2 → counter returns 1. 1 < 2 → next().
5. Brand creates campaign #3 → counter returns 2. 2 >= 2 → 422 QUOTA_EXCEEDED.
6. Frontend QuotaWallModal renders the popup with "Limit reached on the free plan: active campaigns (2 / 2). Upgrade to continue." + upgrade_to list of tiers offering more.

## Workflow C — admin bumps the limit live
1. Admin re-opens Section C, sets "Active campaigns" to 5, saves.
2. tier_features.quota_value = 5.
3. Brand's NEXT create attempt (within 60s) may still see old cached value (entitlements service has 60s TTL). After cache window, new limit applies.
4. Brand creates campaign #3 → counter=2, limit=5, next(). Success.

## Workflow D — enterprise tier with quota_value=-1
1. Brand on Enterprise tier. tier_features.quota_value = -1 for active_campaigns.
2. Middleware: limit = -1 → next() immediately without counting.

## Workflow E — upgrade_to query
1. When brand on Free hits the wall, middleware queries:
   "Which active tiers have tier_features.quota_value > 2 (or -1) for active_campaigns?"
2. Returns [growth, pro, enterprise] (because growth=3, pro=10, enterprise=-1 per M061 defaults).
3. Popup's "View plans" button links to /dashboard/settings/subscription.

## Success
- pnpm qa main 76/76 GREEN unchanged.
- pnpm qa:db quotaCheck tests pass against the new middleware.
- Backend boot smoke clean.
- After prod M062 + push: founder can edit Section C limits and brands see the new quotas at the gate within 60s.

## Failure modes
- Admin removes a tier_features row for a quota feature → entitlements falls back to catalog default. Brand still gated.
- Admin sets quota_value=0 → 0 == 0 trips on first create. Brand sees the wall immediately. Acceptable (admin can set 0 to disable a feature entirely; very explicit).
- Entitlements service throws (DB error) → middleware throws too → 500. Same failure mode as pre-A12.1 when the legacy column read failed.
