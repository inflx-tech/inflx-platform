# Workflow — ui-polish-feature-gates

## Actor
Brand user interacting with brand-web admin surfaces protected by
backend gates.

## Workflow A — modal pop on FEATURE_NOT_AVAILABLE

1. Free brand on the campaigns/new wizard configures an open-group
   set + hits Publish.
2. Frontend calls `POST /v1/campaigns/:id/publish`.
3. Backend returns 422 with `code: 'FEATURE_NOT_AVAILABLE'`,
   `field: 'bulk_outreach'`, `details: { feature_key:
   'bulk_outreach', upgrade_to: ['growth','pro','enterprise'] }`.
4. Page's existing `showFromResponse(res)` handler — unchanged in
   the page code — now matches the FEATURE_NOT_AVAILABLE code via
   the extended `isQuotaError`.
5. Modal opens with title "Feature not on your plan", body
   "Bulk influencer outreach is not available on your current plan.
   Upgrade to use it.", and upgrade_to tier chips + "View plans"
   CTA linking to /dashboard/settings/subscription.

## Workflow B — modal pop on FEATURE_LIMIT (niches limit)

1. Growth brand on campaigns/new tries to broadcast to influencers
   matching 15 niches when their tier allows 10.
2. Backend returns 422 with `code: 'FEATURE_LIMIT'`, details
   carrying `feature_key`, `config_key: 'niches_limit'`, `used: 15`,
   `limit: 10`.
3. Modal opens with title "Feature limit reached", same upgrade_to
   chips + CTA. used/limit rows render (this code carries them).

## Workflow C — Free brand opens profile

1. Free brand opens /dashboard/settings/profile.
2. Profile page calls `useEntitlements()`.
3. Hook fetches /v1/brands/me/subscription → returns entitlements
   map + tier_key='free'.
4. Hook resolves `has('multi_branch_support') = false`.
5. Branches & Outlets card header omits the "+ Add Branch" button.
   In its place, renders a small chip:
   *"Multi-branch is on Pro and Enterprise plans · View plans →"*.
6. Brand can still view the Main Branch and any existing extras
   (grandfathered) but can't add more.

## Workflow D — Pro brand opens profile

1. Pro brand opens /dashboard/settings/profile.
2. Hook resolves `has('multi_branch_support') = true`.
3. "+ Add Branch" button renders normally.

## Workflow E — entitlements fetch fails / hook loading

1. Brand opens /dashboard/settings/profile.
2. Hook fetches entitlements but the network is slow / fails.
3. While `loading=true`: button renders optimistically (no flash of
   "locked" state for tiers that DO have the feature).
4. If the brand actually lacks the feature and the fetch fails, the
   backend gate still blocks the save and the QuotaWallModal pops.
   Defence-in-depth.

## Success
- pnpm qa main lane GREEN unchanged.
- All three error codes pop the modal with appropriate copy.
- Free/Growth brands no longer see the "+ Add Branch" button on the
  profile editor; they see the locked hint instead.
- Pro/Enterprise brands see the button as before.

## Failure modes
- Entitlements fetch fails → hook returns `loading: true` initially,
  then `error: <msg>` if the fetch errors. Button renders
  optimistically; backend gate is the safety net.
- 5min cache stale after admin flips an override → 60s entitlements
  service cache + 5min hook cache mean a brand's view of their
  entitlements can lag up to 5min after admin grants/revokes. Hard
  refresh clears the hook cache instantly.
- Modal doesn't pop for an unknown error code → page's fallback
  error path takes over (`if (!showFromResponse(res)) setErr(...)`).
  No regression.
