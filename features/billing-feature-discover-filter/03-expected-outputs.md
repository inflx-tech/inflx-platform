# Expected Outputs — billing-feature-discover-filter (A12.2)

## Database
- `features.is_enforced = true` for `discover_filter` (after M063).
- Other features unchanged.

## Backend behaviour
- `GET /v1/campaigns/:id/influencer-search` response now includes `discover_filter: { area_scope: <city|state|all_india> }` alongside existing `influencers + total`.
- `GET /v1/campaigns/:id/sets/:sid/open-group-matches` response now includes `discover_filter: { area_scope, niches_limit }`.
- Both endpoints inject area_scope SQL filter when config dictates.
- Open-group throws 422 `FEATURE_LIMIT` when niches array exceeds tier's niches_limit.

## Response payload examples

`searchInfluencers` (Free brand in Vijayawada):
```json
{
  "success": true,
  "data": {
    "influencers": [...only-Vijayawada influencers...],
    "total": 7,
    "discover_filter": { "area_scope": "city" }
  }
}
```

`openGroupMatches` over the niches_limit:
```json
{
  "success": false,
  "error": {
    "code": "FEATURE_LIMIT",
    "message": "Your plan allows up to 3 niches per open-group broadcast (you requested 4). Upgrade for more.",
    "field": "niches",
    "details": {
      "feature_key": "discover_filter",
      "config_key": "niches_limit",
      "used": 4,
      "limit": 3
    }
  }
}
```

## Test results
- pnpm qa main GREEN unchanged.
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING: Render redeploys backend. M063 needs separate
explicit founder go to apply on Supabase prod.
