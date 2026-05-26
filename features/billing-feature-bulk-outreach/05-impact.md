# Impact — billing-feature-bulk-outreach (A12.4)

## Changes
- 1 helper added to entitlements.service (`requireFeature`) — reusable for all future boolean gates.
- 1 gate hook added to publishOpenGroup (3 lines).
- 1 migration (M065) flips is_enforced=true.
- 1 runner script.
- 1 contract folder.

## Blast radius
- Single endpoint affected: `POST /campaigns/:id/sets/:sid/publish-open`.
- Behaviour change after deploy + M065: Free brands blocked from bulk-outreach; Growth+ unaffected.
- The `requireFeature` helper is additive — adding it to entitlements.service doesn't change behaviour of existing exports (hasFeature, quotaFor, configFor).
- Helper reuse: future A12.5 (open_group_broadcast boolean part), A12.6 (multi_branch_support), and any future boolean feature gate can call `entitlementsService.requireFeature(db, brandId, 'xxx')` instead of writing inline gate logic.

## Rollback
Revert commit + revert M065 (`UPDATE features SET is_enforced=false WHERE feature_key='bulk_outreach'`). All publishOpenGroup calls return to ungated behaviour immediately.

## Risks
- **Frontend may still expose the Publish button on the open-group set** for Free brands. Brand sees 422 → may be confusing without UI hiding. Mitigation: short-term, the existing error toast on the campaign builder shows the message; longer-term, hide the Publish button for tiers without bulk_outreach (separate UI polish contract).
- **Brand has no tier_features row** → defensive default is `included=false` → blocked. Admin must ensure rows exist (M061 seeded all 4 tiers).
- **Gate fires before any DB write** — no partial-publish state. Safe.

## Pre-push checklist
1. pnpm qa main GREEN.
2. Backend boot smoke clean.
3. M065 applied locally + sanity probe shows is_enforced=true.
4. gov-check exit 0 (Rules 1+3+4).
5. M065 prod run gated on separate explicit founder go after push.
