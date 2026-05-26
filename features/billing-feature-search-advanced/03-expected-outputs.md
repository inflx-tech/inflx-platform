# Expected Outputs — billing-feature-search-advanced (A12.3)

## Database (after M064)
- `features.is_enforced = true` for `search_filters_advanced`.

## API JSON shapes

**Success path (advanced filters allowed):** unchanged.

**Block path (Free brand passes tier or min_er):**
```json
{
  "success": false,
  "error": {
    "code": "FEATURE_NOT_AVAILABLE",
    "message": "Advanced search filters (tier, min_er) are not available on your current plan. Upgrade to use them.",
    "field": "search_filters_advanced",
    "details": {
      "feature_key": "search_filters_advanced",
      "blocked_params": ["tier", "min_er"],
      "upgrade_to": ["growth", "pro", "enterprise"]
    }
  }
}
```

## Test results
- pnpm qa main GREEN unchanged.
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING: Render redeploys backend. M064 needs separate
explicit founder go to apply on Supabase prod.
