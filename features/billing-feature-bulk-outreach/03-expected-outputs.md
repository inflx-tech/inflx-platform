# Expected Outputs — billing-feature-bulk-outreach (A12.4)

## Database (after M065)
- `features.is_enforced = true` for `bulk_outreach`.

## API JSON shapes

**Success path (Growth+ brand publishes open-group):** unchanged.

**Block path (Free brand attempts publishOpenGroup):**
```json
{
  "success": false,
  "error": {
    "code": "FEATURE_NOT_AVAILABLE",
    "message": "Bulk influencer outreach is not available on your current plan. Upgrade to use it.",
    "field": "bulk_outreach",
    "details": {
      "feature_key": "bulk_outreach",
      "upgrade_to": ["growth", "pro", "enterprise"]
    }
  }
}
```

## Test results
- pnpm qa main GREEN unchanged.
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING: Render redeploys backend. M065 needs separate explicit founder go to apply on Supabase prod.
