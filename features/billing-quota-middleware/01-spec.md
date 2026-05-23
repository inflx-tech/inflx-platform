# billing-quota-middleware — checkQuota middleware (Phase A4)

> **Phase A4 of the INFLX 3-Layer Revenue Model.** Enforces subscription
> tier limits at write-action time. Adds a quota-check Express
> middleware applied to 4 brand-side create endpoints. Returns
> structured `422 QUOTA_EXCEEDED` with the data the front-end needs to
> show the upgrade modal.

## What ships
- `backend/src/middleware/quotaCheck.js` — middleware factory
  `checkQuota(action)` returning express middleware.
- 4 routes wired:
  - `POST /v1/campaigns` → `checkQuota('createCampaign')`
  - `POST /v1/campaigns/:id/sets` → `checkQuota('createSet')`
  - `POST /v1/campaigns/:id/sets/:sid/invite` → `checkQuota('inviteInfluencer')`
  - `POST /v1/brands/me/products` → `checkQuota('createProduct')`
- `AppError` extended to accept an optional `details` payload
  (backward-compatible — existing 4-arg callsites unchanged).
- `response.error()` + `errorHandler` pass `err.details` through to the
  JSON body as `error.details`.
- Test factory `registerBrand` auto-upserts an enterprise-tier
  `brand_subscriptions` row by default → existing tests don't break.
  `setBrandTier(brandId, tierKey)` helper lets quota tests downgrade.

## Quota response shape
```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Limit reached on the free plan: products (10 / 10). Upgrade to continue.",
    "field": "createProduct",
    "details": {
      "action": "createProduct",
      "used": 10,
      "limit": 10,
      "current_tier": "free",
      "upgrade_to": ["growth", "pro", "enterprise"]
    }
  }
}
```

## Tier behaviour
- `-1` limit = unlimited (enterprise). Middleware short-circuits with
  `next()` immediately, no DB count.
- Lazy create: brand without a `brand_subscriptions` row gets a
  `free` row created on first quota check (idempotent via
  uniq_brand_subs_active partial unique).

## Tests
`backend/tests/quotaCheck.test.js` (3 describe blocks):
- 11th product on free tier → 422 with full payload.
- 12 products on enterprise → all succeed.
- Brand with no subscription → lazy-create on first quota check yields
  a `free` row.

## Backward compat
- All existing tests pass because `registerBrand` auto-upserts
  enterprise tier. No assertion changes anywhere else.
- The middleware is applied AFTER `authenticate`/`requireRole`/
  `requireApproved` so the user-facing error order stays consistent
  (auth → role → approved → quota).
