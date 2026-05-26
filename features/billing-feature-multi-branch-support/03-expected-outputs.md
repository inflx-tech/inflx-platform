# Expected Outputs — billing-feature-multi-branch-support (A12.6)

## Database (after M067)
- `features.is_enforced = true` for `multi_branch_support`.

## API JSON shapes

**Success path (Pro/Enterprise brand saves multiple branches, or any
tier edits non-branch fields):** unchanged response shape. The
`brands.listing_data.branches` array reflects the new state.

**Block path (Free/Growth brand tries to add a 2nd+ branch):**
```json
{
  "success": false,
  "error": {
    "code": "FEATURE_NOT_AVAILABLE",
    "message": "Multi-branch support is not available on your current plan. Upgrade to use it.",
    "field": "multi_branch_support",
    "details": {
      "feature_key": "multi_branch_support",
      "upgrade_to": ["pro", "enterprise"]
    }
  }
}
```

## Test results
- pnpm qa main lane GREEN unchanged.
- Backend boot smoke clean.
- M067 applied to local dev DB; sanity probe shows is_enforced=true.

## Deploy posture
PRODUCTION-IMPACTING: Render redeploys backend with the gate in
`brand.controller.updateMe`. M067 needs separate explicit founder go
to apply on Supabase prod.
