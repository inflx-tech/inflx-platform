# billing-feature-bulk-outreach — Phase A12.4

> Third per-feature enforcement after A12.2/A12.3. Boolean gate on the
> open-group publish endpoint (`publishOpenGroup`), which is the
> bulk-outreach action — materializes campaign_influencer rows for
> every matching influencer in one shot. Reusable `requireFeature`
> helper added to entitlements.service for future per-feature contracts.

## What ships

**Backend — reusable helper**
- `entitlements.service.requireFeature(client, brandId, featureKey, opts)`.
- Calls `hasFeature` under the hood; throws `AppError('FEATURE_NOT_AVAILABLE')` with structured `{feature_key, upgrade_to}` payload if blocked.
- Honours `is_enforced` (silent pass-through when not enforced).
- Single source of truth for all future boolean-feature gates.

**Backend — gate wired**
- `POST /v1/campaigns/:id/sets/:sid/publish-open` (offer.controller.js `publishOpenGroup`) — gate fires immediately after brand-ownership check, before any campaign / set lookup.

**Migration M065**
- `UPDATE features SET is_enforced=true WHERE feature_key='bulk_outreach'`.
- Idempotent. Same flip pattern as M062/M063/M064.

## Tier defaults (M061 seed)
- Free: NOT included → 422 if brand tries to publish open-group.
- Growth / Pro / Enterprise: included → bulk-outreach works freely.

Admin can flip any tier's flag in `/admin/pricing/tiers/[tier_key]` Section C; takes effect within 60s entitlements cache.

## Out of scope
- Frontend "hide the publish-open button" for tiers without the feature. Backend gate is the source of truth; UI polish ships later (small follow-up — extend QuotaWallModal to recognise `FEATURE_NOT_AVAILABLE` alongside `QUOTA_EXCEEDED`).
- Per-influencer single-invite endpoint (`POST /:id/sets/:sid/invite`) — already gated by A12.1's `invitations_per_cycle` quota; the bulk_outreach feature only governs the bulk action.
- Other features (open_group_broadcast, multi_branch_support) — A12.5+ each own contract.

## Files
- `backend/src/services/entitlements.service.js` — `requireFeature` helper.
- `backend/src/controllers/offer.controller.js` — gate added to `publishOpenGroup`.
- `backend/migrations/065_enforce_bulk_outreach.sql` + `backend/scripts/run-065.js`.
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING — Render redeploys backend; M065 needs separate explicit founder go.
- Backward compatible: pre-M065 the gate is a no-op even with all code deployed (is_enforced=false → hasFeature returns true).
- API JSON shape unchanged on success; new 422 envelope on block.
