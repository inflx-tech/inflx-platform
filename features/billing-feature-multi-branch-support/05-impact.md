# Impact — billing-feature-multi-branch-support (A12.6)

## Changes
- `brand.controller.updateMe`: pre-flight gate that compares
  `req.body.listing_data?.branches` length against existing
  `brand.listing_data?.branches` length. Fires `requireFeature` only
  when the count is increasing beyond the existing count AND > 1.
- 1 migration (M067) flips `is_enforced=true` on multi_branch_support.
- 1 runner script.
- 1 contract folder.

## Blast radius
- `PATCH /v1/brands/me` — single endpoint affected. Only the
  add-more-branches path is gated.
- Behaviour change after deploy + M067: Free/Growth brands blocked from
  saving more than 1 branch (Main). Pro/Enterprise unchanged.
- Editing other profile fields (business_name, address_line, logo_url,
  GSTIN, category) unaffected on any tier.
- Reducing branches is never gated.

## Grandfathering rationale
The gate uses **count-is-increasing** logic, not a hard `> 1` cap.
Reason: the frontend always re-sends the full `listing_data` (including
the existing branches array) on every save. A hard cap would lock any
Free/Growth brand who happens to have > 1 branches saved today out of
editing other profile fields entirely. Count-is-increasing preserves
edit capability for grandfathered data while still blocking new
additions.

## Rollback
Revert commit + revert M067 (`UPDATE features SET is_enforced=false
WHERE feature_key='multi_branch_support'`). Free/Growth brands can
add branches again.

## Risks
- **Frontend UI does not hide the + Add Branch button for Free/Growth.**
  The button stays visible; brand only sees the 422 on save. Acceptable
  per the established pattern (A12.4/A12.5 left frontend hide as
  follow-up). Mitigation: the error message is human-readable and
  includes `upgrade_to`.
- **Empty/malformed listing_data on existing brands** → existing count
  resolves to 0; first save with `length > 1` correctly trips the gate.
- **listing_data missing branches key entirely on the patch** (brand
  only updates business_name) → gate skipped, save proceeds.
- **Race between admin tier change and brand save** → 60s entitlements
  cache. Acceptable.
- **Gate fires before the SQL UPDATE** → no partial-save risk.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Backend boot smoke clean.
3. M067 applied locally + sanity probe shows is_enforced=true.
4. gov-check exit 0 (Rules 1+3+4).
5. M067 prod run gated on separate explicit founder go after push.
