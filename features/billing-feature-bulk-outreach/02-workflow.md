# Workflow — billing-feature-bulk-outreach (A12.4)

## Actor
Brand publishing an open-group campaign set during campaign creation.

## Preconditions
- A10/A12.1/A12.2/A12.3 shipped.
- M065 applied (is_enforced=true on bulk_outreach).
- Free tier's tier_features row for bulk_outreach has included=false (default seed).

## Workflow A — Free brand tries to publish open-group set
1. Brand on Free creates a campaign, builds an open-group set with filter criteria, hits Publish.
2. Frontend calls `POST /campaigns/:id/sets/:sid/publish-open`.
3. `publishOpenGroup` controller runs: brand-ownership check passes.
4. `entitlementsService.requireFeature(db, brand.id, 'bulk_outreach')` fires.
5. `hasFeature` returns false (Free tier doesn't include it).
6. Throws 422 FEATURE_NOT_AVAILABLE with payload `{feature_key: 'bulk_outreach', upgrade_to: ['growth','pro','enterprise']}`.
7. Frontend can render the upgrade modal.

## Workflow B — Growth brand publishes open-group set
1. Same flow as A.
2. `hasFeature` returns true (Growth includes it per M061 seed).
3. `requireFeature` returns silently.
4. Publish proceeds normally — campaign_influencer rows materialized for matching influencers + push notifications fire.

## Workflow C — admin promotes Free to bulk_outreach
1. Admin opens `/admin/pricing/tiers/free` Section C.
2. Toggles bulk_outreach "Included" checkbox to ON.
3. Saves → PUT `/admin/tiers/free/features` writes the row.
4. Within 60s (entitlements cache TTL), Free brands can publish open-group sets.

## Workflow D — handpick set unaffected
1. Brand on Free builds a HANDPICK set (single influencer invites).
2. Publishes campaign → individual invites fire one at a time via the existing `invite` endpoint.
3. bulk_outreach gate not relevant; only invitations_per_cycle quota (A12.1) applies.

## Success
- pnpm qa GREEN.
- Free brand trying publishOpenGroup → 422 FEATURE_NOT_AVAILABLE.
- Growth+/Pro+/Enterprise+ brands publish open-group sets freely.
- Handpick set publishing unaffected.
- Admin toggle takes effect within 60s.

## Failure modes
- Feature not yet enforced (M065 not run) → requireFeature returns silently → no-op gate. Pre-M065 deploy is behaviour-inert.
- Brand has no tier_features row for bulk_outreach → `included=false` default → blocked. Admin can fix by adding the row.
- requireFeature throws → controller's asyncHandler propagates to errorHandler → standard error envelope returned. No partial-publish risk (gate fires before any DB write).
