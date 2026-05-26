# billing-feature-multi-branch-support — Phase A12.6

> Fifth per-feature enforcement after A12.2/A12.3/A12.4/A12.5. Boolean
> gate on the brand profile save path. Brand-web + brand-mobile both
> render an "Add Branch" button in the Profile → Branches & Outlets
> card; this contract gates the save when the resulting list exceeds
> one branch (Main).

## What ships

**Backend — gate on brand profile save**

`PATCH /v1/brands/me` (`brand.controller.updateMe`) gets a pre-flight
gate. When the patch payload contains
`listing_data.branches` with more than one entry **and** the count is
increasing beyond what the brand already has saved, the gate fires:

- `requireFeature(db, brand.id, 'multi_branch_support')` → 422
  FEATURE_NOT_AVAILABLE with `feature_key: 'multi_branch_support'` and
  `upgrade_to: ['pro', 'enterprise']`.

**Grandfathered behaviour (intentional):** the gate fires only when
the patch is **adding** branches beyond the existing count. Existing
brands with multiple branches saved (pre-A12.6) can still edit other
profile fields without being locked out — the frontend re-sends the
full `listing_data` on every save, so a hard "length > 1" gate would
brick their profile.

| Patch scenario | Gate fires? |
|----------------|-------------|
| Brand has 0 branches, patch adds 0 (no branches in payload) | no |
| Brand has 1 (Main), patch keeps 1 | no |
| Brand has 1, patch adds 1 more (total 2) | **yes** for Free/Growth |
| Brand has 3 (pre-gate), patch keeps 3 (editing other fields) | no |
| Brand has 3, patch reduces to 2 | no |
| Brand has 3, patch adds a 4th | **yes** for Free/Growth |

**Where "branches" actually live in the schema**

Branches are NOT a separate table. They are persisted as a JSON array
inside `brands.listing_data.branches` (jsonb). `branches[0]` is always
the Main Branch (auto-named by the UI); `branches[1...]` are
additional branches added via "+ Add Branch". Both the brand-web
profile page (`Packages/brand-web/app/dashboard/settings/profile/page.js`)
and the brand-mobile profile screen (`Packages/Mobile/src/screens/brand/
BrandProfileScreen.js`) read/write this shape via the existing
`PATCH /v1/brands/me` endpoint — no dedicated branches route exists.

**Migration M067**
- `UPDATE features SET is_enforced=true WHERE feature_key='multi_branch_support'`.
- Idempotent. Forward-only. Same flip pattern as M062/M063/M064/M065/M066.

## Tier defaults (M061 seed)

| Tier | included | Saves > 1 branch? |
|------|----------|--------------------|
| Free | false | blocked |
| Growth | false | blocked |
| Pro | true | allowed |
| Enterprise | true | allowed |

Admin can flip any tier's flag in `/admin/pricing/tiers/[tier_key]`
Section C; takes effect within 60s entitlements cache.

## Out of scope

- Frontend "hide the + Add Branch button" for Free/Growth. The button
  stays visible; backend gate is the source of truth. Brand sees the
  422 in the existing error toast on save. UI polish is a follow-up
  (same pattern as A12.4/A12.5).
- Migration / cleanup of existing Free/Growth brands who have
  multi-branch data saved today. They're grandfathered — they keep
  what they have, just can't add more.
- Per-branch CRUD endpoints (e.g. `DELETE /branches/:id`). Not built;
  the whole list lives in one jsonb column and round-trips through
  the profile patch.

## Files
- `backend/src/controllers/brand.controller.js` — `updateMe` gets the
  multi_branch_support gate.
- `backend/migrations/067_enforce_multi_branch_support.sql` +
  `backend/scripts/run-067.js`.
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING — Render redeploys backend with
  the gate. M067 needs separate explicit founder go to apply on
  Supabase prod.
- Backward compatible: pre-M067 the gate is no-op (`requireFeature`
  returns silently when `is_enforced=false`); grandfathering keeps
  existing brands editable post-M067.
- Gate fires before the SQL UPDATE — no partial-write risk.
- API JSON shape unchanged on success; new 422 envelope on block.
