# 06-diff — billing-feature-multi-branch-support (A12.6)

**Before:** any brand on any tier could save any number of branches in
their profile. The brand-web (`/dashboard/settings/profile`) and
brand-mobile (`BrandProfileScreen`) Profile → Branches & Outlets
card's "+ Add Branch" button worked freely for every plan, and the
PATCH /v1/brands/me payload persisted the resulting list with no
tier-aware constraint.

**After (A12.6):** the `updateMe` controller checks the patch payload
before the UPDATE. The gate compares the incoming
`listing_data.branches` count against the existing count on the brand
row, and only fires when the patch is **adding** branches beyond what's
already there:

| Tier | Existing | Incoming | Gate fires? |
|------|----------|----------|-------------|
| Free   | 1 (Main) | 1                  | no — no extras |
| Free   | 1 (Main) | 2 (Main + 1 extra) | **yes — 422 FEATURE_NOT_AVAILABLE** |
| Free   | 3 (grandfathered) | 3        | no — editing other fields stays open |
| Free   | 3        | 4                  | **yes — 422** |
| Free   | 3        | 2                  | no — reducing always allowed |
| Pro    | 1        | 5                  | no — Pro includes the feature |
| any    | (no listing_data on patch) | (no compare)  | no — patch lacks the array |

**Why count-is-increasing (not a hard cap):** the brand profile UI
re-sends the entire `listing_data` (including the branches array) on
every save, even when the brand is only editing `business_name`. A
hard "block any patch where length > 1" rule would lock any
grandfathered Free/Growth brand out of editing their profile
altogether. Count-is-increasing preserves edit capability for
existing data while still gating new additions.

**Error envelope** (returned by `updateMe` before the SQL UPDATE):

```json
{ "code": "FEATURE_NOT_AVAILABLE",
  "message": "Multi-branch support is not available on your current plan. Upgrade to use it.",
  "field": "multi_branch_support",
  "details": {
    "feature_key": "multi_branch_support",
    "upgrade_to": ["pro", "enterprise"]
  } }
```

**Defensive fail-open (matches A12.2/A12.3/A12.4/A12.5 pattern):**
- `multi_branch_support.is_enforced=false` (pre-M067) → `requireFeature`
  returns silently. Gate is a no-op. The deploy is behaviour-inert
  until the flag flips.
- Patch missing `listing_data.branches` → gate skipped (no array).
- Patch length === existing length → gate skipped (no addition).
- Patch length < existing length → gate skipped (reducing).

**Where "branches" actually live:** `brands.listing_data.branches` is
a jsonb array on the brands row. `branches[0]` is the Main Branch
(auto-named); `branches[1...]` are additional branches. The UI's
"+ Add Branch" appends to this array; Save sends the whole array back
via PATCH /v1/brands/me. There is no dedicated branches route or
table — this is intentional in the existing schema.

**Frontend UI hide is intentionally NOT in this contract.** Same as
A12.4/A12.5 — the backend gate is the source of truth; hiding the
"+ Add Branch" button for Free/Growth is a small follow-up (extend
the existing error handling on the profile page to recognise
`FEATURE_NOT_AVAILABLE` and surface the upgrade prompt).

**Verified locally:** gate logic boot-smokes clean; M067 applied to
dev DB; sanity probe shows multi_branch_support.is_enforced=true.
