# Expected Outputs — ui-polish-feature-gates

## Database
None. UI-only contract.

## API JSON shapes
Unchanged. The hook consumes the existing `GET /v1/brands/me/subscription`
response.

## UI changes

**Modal — extended copy per code:**

| Error code | Title | Used/limit rows | Notes |
|------------|-------|------------------|-------|
| QUOTA_EXCEEDED | "Plan limit reached" | shown | existing behaviour |
| FEATURE_NOT_AVAILABLE | "Feature not on your plan" | hidden | new |
| FEATURE_LIMIT | "Feature limit reached" | shown | new |

All three render the same upgrade_to chips + "View plans" CTA.

**Profile page Branches & Outlets card:**

- Pro / Enterprise: header shows "+ Add Branch" button as before.
- Free / Growth: header shows the locked hint chip
  *"Multi-branch is on Pro and Enterprise plans · View plans →"*
  (links to /dashboard/settings/subscription).
- During hook loading: button renders optimistically (no flash of
  "locked").

## Test results
- pnpm qa main lane GREEN unchanged.
- Manual smoke: profile page renders for the founder's Free
  testbrand without the Add Branch button; pricing/tiers admin
  page confirmation that Pro/Enterprise have multi_branch_support
  included.

## Deploy posture
PRODUCTION-IMPACTING (Vercel redeploys brand-web) but
backend-touchless. No migration. No prod-go required beyond the
push itself.
