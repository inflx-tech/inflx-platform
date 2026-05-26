# Expected Outputs — billing-feature-open-group-broadcast (A12.5)

## Database (after M066)
- `features.is_enforced = true` for `open_group_broadcast`.

## API JSON shapes

**Success path (Growth+ brand publishes campaign with open-group set):**
unchanged response shape. `campaign_influencers` row count for the
open-group set is capped at the tier's `max_recipients`; area_scope
filter restricts to influencers in the brand's city/state when
applicable.

**Block path — Free brand publishes campaign with open-group set:**
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

If the brand somehow has `bulk_outreach` granted but
`open_group_broadcast.max_recipients == 0`, the second gate fires:
```json
{
  "success": false,
  "error": {
    "code": "FEATURE_NOT_AVAILABLE",
    "message": "Open-group broadcast is not available on your current plan. Upgrade to publish open-group campaigns.",
    "field": "open_group_broadcast",
    "details": {
      "feature_key": "open_group_broadcast",
      "upgrade_to": ["growth", "pro", "enterprise"]
    }
  }
}
```

## Test results
- pnpm qa main lane GREEN unchanged.
- Backend boot smoke clean.
- M066 applied to local dev DB; sanity probe shows is_enforced=true.

## Deploy posture
PRODUCTION-IMPACTING: Render redeploys backend with the gate moved to
`campaign.controller.publish` and the cap+scope logic in
`materialiseOpenGroupInvites`. M066 needs separate explicit founder
go to apply on Supabase prod.

M065 (deferred from A12.4 last session) is bundled in the same
follow-up: applying M065 + M066 together activates both gates on the
new (correct) wiring path simultaneously. Applying M066 alone is
also safe — the `open_group_broadcast.max_recipients==0` check
blocks Free even if `bulk_outreach` stays unenforced.
