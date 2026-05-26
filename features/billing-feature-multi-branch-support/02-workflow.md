# Workflow — billing-feature-multi-branch-support (A12.6)

## Actor
Brand on the profile editor (web `/dashboard/settings/profile` or
mobile BrandProfileScreen) interacting with the **Branches & Outlets**
card.

## Preconditions
- A10/A12.1/A12.2/A12.3/A12.4/A12.5 shipped.
- M067 applied (is_enforced=true on multi_branch_support).
- Default seed: Free/Growth=false, Pro/Enterprise=true.

## Workflow A — Free brand tries to add a second branch

1. Brand on Free opens profile editor. Branches & Outlets card shows
   just the Main Branch.
2. Brand taps **+ Add Branch**. Frontend appends an empty branch row
   to local state. Card now shows 2 entries (Main + 1 new).
3. Brand fills in the new branch fields, taps Save.
4. Frontend sends `PATCH /v1/brands/me` with
   `listing_data.branches: [main, extra1]` (length 2).
5. `brand.controller.updateMe` runs: loads existing brand row (existing
   branches count = 1).
6. Gate evaluates: `incoming.length (2) > 1` AND `incoming.length (2)
   > existing.length (1)` → fire.
7. `requireFeature(db, brand.id, 'multi_branch_support')` →
   `hasFeature` returns false (Free tier doesn't include it).
8. Throws **422 FEATURE_NOT_AVAILABLE** with `feature_key:
   'multi_branch_support'`, `upgrade_to: ['pro','enterprise']`.
9. Frontend renders the error in the existing toast; the new branch
   row stays in the UI (no persistence). User can either upgrade or
   remove the new row.

## Workflow B — Pro brand adds a second branch (happy path)

1. Same flow as A through step 5.
2. Gate evaluates: `incoming.length > 1` AND `> existing.length` → fire.
3. `hasFeature` returns true (Pro tier includes it).
4. `requireFeature` returns silently.
5. UPDATE proceeds — `brands.listing_data` now has 2 branches.
6. Profile editor re-fetches and shows both.

## Workflow C — Free brand edits business_name (existing 1 branch)

1. Free brand has just Main Branch saved (length 1).
2. Brand changes business name, hits Save.
3. Frontend sends `PATCH /v1/brands/me` with `business_name: '...',
   listing_data: { branches: [main], ... }` (length 1).
4. Gate evaluates: `incoming.length (1) > 1` → false → gate skipped.
5. Update proceeds. No 422. No business disruption.

## Workflow D — Grandfathered Free brand (pre-existing 3 branches)

This case can exist if a brand had multiple branches saved before
M067 was applied.

1. Free brand has 3 branches saved (Main + 2 extras) — pre-A12.6.
2. Brand changes business name, hits Save.
3. Frontend sends `PATCH /v1/brands/me` with
   `listing_data.branches: [main, extra1, extra2]` (length 3).
4. Gate evaluates: `incoming.length (3) > 1` → true; BUT
   `incoming.length (3) > existing.length (3)` → false → gate skipped.
5. Update proceeds. Brand keeps editing their profile.

If the same Free brand later tries to add a 4th branch:
- `incoming.length (4) > existing.length (3)` → true → gate fires → 422.

## Workflow E — Free brand reduces branches

1. Same Free brand with 3 branches.
2. Brand removes 2 extras. Frontend sends
   `listing_data.branches: [main]` (length 1).
3. Gate evaluates: `incoming.length (1) > 1` → false → gate skipped.
4. Update proceeds. Branches go from 3 to 1.

## Workflow F — admin promotes Free for multi_branch_support

1. Admin opens `/admin/pricing/tiers/free` Section C.
2. Toggles multi_branch_support "Included" checkbox to ON.
3. Saves → existing PUT endpoint writes the row.
4. Within 60s entitlements cache TTL, Free brands can save multiple
   branches.

## Workflow G — feature not yet enforced (pre-M067)

1. Code is deployed; M067 not yet applied.
2. `hasFeature` returns true (defensive — `is_enforced=false` means
   gate is a no-op).
3. Behaviour identical to pre-A12.6.

## Success
- pnpm qa main lane GREEN.
- Free/Growth brands trying to add a 2nd branch → 422
  FEATURE_NOT_AVAILABLE.
- Pro/Enterprise brands add/edit/remove branches freely.
- Grandfathered brands keep editing without disruption.
- Reducing branch count never blocks.
- Admin toggle takes effect within 60s.

## Failure modes
- M067 not applied → gate is a no-op (defensive fail-open). Pre-M067
  deploy is behaviour-inert.
- Brand has no listing_data → existing count is 0; first save with
  `length > 1` trips the gate for Free/Growth (correct intent).
- Patch payload lacks `listing_data.branches` (brand only edits
  non-branch fields like business_name) → gate skipped entirely
  (no array to compare).
- Gate fires before UPDATE → no partial-save risk.
