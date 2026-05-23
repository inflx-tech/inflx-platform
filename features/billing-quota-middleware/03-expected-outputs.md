# Expected Outputs — billing-quota-middleware (Phase A4)

## Files
- `backend/src/middleware/quotaCheck.js` (new)
- `backend/src/routes/campaign.routes.js` (3 routes wired: createCampaign / createSet / inviteInfluencer)
- `backend/src/routes/brand.routes.js` (1 route wired: createProduct)
- `backend/src/utils/AppError.js` (+ details arg, backward-compat)
- `backend/src/utils/response.js` (+ details in error body)
- `backend/src/middleware/errorHandler.js` (passes details through)
- `backend/tests/helpers/factories.js` (registerBrand auto-upserts enterprise; new setBrandTier helper)
- `backend/tests/quotaCheck.test.js` (new — 3 assertions)
- `features/billing-quota-middleware/*` (this contract)

## API response — new error type
422 with body:
```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Limit reached on the <tier> plan: <label> (<used> / <limit>). Upgrade to continue.",
    "field": "<action>",
    "details": {
      "action": "<action>",
      "used":   <int>,
      "limit":  <int>,
      "current_tier": "<tier_key>",
      "upgrade_to":   ["<tier_key>", ...]
    }
  }
}
```

## Test invariants
- 67/67 pnpm qa main lane GREEN — unchanged because tests don't exercise the brand 11th-product path.
- backend jest delta: +3 quotaCheck assertions GREEN; zero regression in pre-existing suites (factory auto-enterprise unblocks them).

## Deploy posture
PRODUCTION-IMPACTING — `backend/src/**` touched, middleware ships on
Render. Behaviourally: Free-tier brands suddenly hit hard walls on
their 2nd campaign, 11th product, etc. Existing brands without a
subscription row are lazy-created as Free (matching new product
default) — this means brands that previously had >1 campaign / >10
products on the legacy unlimited setup are NOT downgraded retroactively
(existing rows persist); they only feel the wall on the NEXT create
attempt.

For an existing brand with say 25 products today, after this ships:
- Listing them: still works (no quota on read).
- Creating product #26: 422 QUOTA_EXCEEDED on Free tier → upgrade.
This is intentional per the brief's Glow Studio walkthrough.
