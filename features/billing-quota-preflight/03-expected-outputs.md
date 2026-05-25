# Expected Outputs — billing-quota-preflight (A12.1.5)

## API
- `GET /v1/brands/me/quota-preflight?action=createCampaign` → `200 {success:true, data:{action, feature_key, would_block, used, limit, current_tier, upgrade_to}}`
- Unknown action → `422 VALIDATION_ERROR field:action`.
- Unauthenticated → `401 UNAUTHORIZED`.
- Non-brand role → `403 FORBIDDEN`.

## UI behaviour
- "+ New campaign" buttons on `/dashboard/campaigns` show "Checking…" briefly on click, then either navigate or show QuotaWallModal.
- "+ Add product" buttons on `/dashboard/products` show "Checking…" briefly on click, then either open add-product modal or show QuotaWallModal.
- QuotaWallModal renders identical to submit-time popups (same component, same styling).

## Test results
- pnpm qa main GREEN unchanged (no spec exercises preflight directly; existing pages still work).
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING via Vercel + Render. No DB migration.
