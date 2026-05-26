# ui-polish-feature-gates — Phase post-A14 follow-up

> Small UI follow-up after the A12.x catalog rollout + A14 overrides.
> No backend changes, no migration. Two concrete improvements:
> (1) make the existing `QuotaWallModal` pop for ALL per-feature gate
> 422s instead of just `QUOTA_EXCEEDED`, and (2) hide the
> "+ Add Branch" button on the brand profile editor for tiers without
> `multi_branch_support` so the brand sees the gate up-front instead
> of submitting and being told "no".

## What ships

**Frontend — QuotaWallModal predicate + render extension**

- `isQuotaError(res)` now returns true for any of the three paywall
  codes the backend throws:
  - `QUOTA_EXCEEDED` — quota gate (A12.1 / quotaCheck middleware).
  - `FEATURE_NOT_AVAILABLE` — boolean feature gate (A12.3/A12.4/
    A12.5/A12.6 via `requireFeature`).
  - `FEATURE_LIMIT` — config gate hitting a per-tier limit
    (A12.2 `niches_limit`).
- The modal adapts its rendering per code:
  - QUOTA_EXCEEDED / FEATURE_LIMIT: keep the used/limit summary rows
    (these codes carry numeric used/limit details).
  - FEATURE_NOT_AVAILABLE: drop the used/limit rows (the code is
    binary — feature is on or off — no numbers to show); render a
    cleaner "feature not on your plan" message + upgrade_to tiers
    + "View plans" CTA.
- Title adapts: "Plan limit reached" stays for QUOTA_EXCEEDED;
  "Feature not on your plan" for FEATURE_NOT_AVAILABLE;
  "Feature limit reached" for FEATURE_LIMIT.
- Backward compatible: every page already calling `showFromResponse(res)`
  works unchanged; the additional codes are folded into the same path.

**Frontend — `useEntitlements()` hook (new)**

New file `Packages/brand-web/lib/useEntitlements.js` exports a React
hook that:
- Fetches `GET /v1/brands/me/subscription` once per mount (with a
  module-level 5min cache to dedupe across components on the same
  page).
- Returns `{ entitlements, tierKey, loading, error, has(key),
  quotaFor(key), configFor(key) }`.
- `has(key)` returns `true | false` (always boolean; `null`/missing
  feature treated as not-included by default).
- `quotaFor(key)` returns the quota number (-1 for unlimited) or
  `null` for non-quota features.
- `configFor(key)` returns the jsonb config or `{}`.
- Returns `loading: true` while the first fetch is in flight so
  callers can decide whether to render the gated UI optimistically.

**Frontend — Hide "+ Add Branch" on profile page**

`Packages/brand-web/app/dashboard/settings/profile/page.js`:
- Calls `useEntitlements()`.
- Renders the existing `+ Add Branch` button only when
  `has('multi_branch_support')` returns true.
- Otherwise renders a small **"Multi-branch is on Pro and Enterprise
  plans"** hint with a link to `/dashboard/settings/subscription`.
- Optimistic rendering during `loading` (renders the button while
  fetching to avoid a flash of "locked" UI for tiers that DO have
  the feature). If the brand turns out to lack it, the backend gate
  still blocks the save and the modal pops.

## Verify-twice

- `GET /v1/brands/me/subscription` (subscription.controller.js:144)
  ALREADY returns `entitlements` (map keyed by `feature_key`) and
  `tier_key` via `entitlementsService.getEntitlementsPlain(db,
  brandId)` (line 165). No new backend endpoint required.
- `entitlements[feature_key].included` is the source of truth and
  honours A14 per-brand overrides.
- All three error codes are confirmed to be thrown by the existing
  backend gates:
  - `QUOTA_EXCEEDED` — `backend/src/middleware/quotaCheck.js`
  - `FEATURE_NOT_AVAILABLE` — `entitlements.service.requireFeature`
    (used by A12.3/A12.4/A12.5/A12.6)
  - `FEATURE_LIMIT` — campaign.controller `openGroupMatches` (A12.2
    niches_limit gate)

## Out of scope

- Proactively hiding the open-group publish button (bulk_outreach +
  open_group_broadcast) inside the campaigns/new wizard — that
  wizard is complex and deserves its own UX pass. The modal-pop
  via QuotaWallModal still fires on submit, which is acceptable
  v1.
- Proactively disabling the advanced-filter inputs (search_filters_advanced)
  on the influencer-search page — same reasoning.
- Mobile equivalents (`Packages/Mobile/src/screens/brand/
  BrandProfileScreen.js` has the same Add Branch flow) — separate
  contract; mobile follows the brand-web pattern but uses native
  components. Deferred.

## Files
- `Packages/brand-web/components/QuotaWallModal.js` — predicate +
  render extension.
- `Packages/brand-web/lib/useEntitlements.js` — new hook (small,
  ~70 lines).
- `Packages/brand-web/app/dashboard/settings/profile/page.js` —
  conditional Add Branch button.
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING (Vercel redeploys brand-web)
  but backend-touchless. No migration. Behaviour-improving only;
  no behaviour regression possible.
- Backward compatible at every layer: the modal extension preserves
  the existing API; the hook is new + additive; the profile-page
  conditional defaults to "render the button while loading" so any
  edge case in the hook fails safely toward the existing behaviour.
- No new design tokens introduced (per Window B sequencing rule).
