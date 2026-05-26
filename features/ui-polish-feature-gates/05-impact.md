# Impact — ui-polish-feature-gates

## Changes
- `Packages/brand-web/components/QuotaWallModal.js`: predicate +
  render extended for FEATURE_NOT_AVAILABLE + FEATURE_LIMIT.
- `Packages/brand-web/lib/useEntitlements.js`: new hook (~70
  lines).
- `Packages/brand-web/app/dashboard/settings/profile/page.js`:
  conditional "+ Add Branch" button + locked hint chip.
- 1 contract folder.
- Zero backend changes. Zero migration.

## Blast radius
- Pages that already use `showFromResponse(res)` (campaigns/page,
  campaigns/new/page, products/page): now pop the modal for the
  additional codes with no per-page wiring. Existing
  QUOTA_EXCEEDED behaviour unchanged.
- Profile page: the only UI surface that gains a proactive hide.
  Other proactive hides (campaigns wizard's publish button,
  influencer-search advanced filters) are deferred — backend gates
  + modal pop are the safety net.
- No backend redeploy effect (Render is untouched). Vercel
  redeploys brand-web with the updated bundle.

## Rollback
Revert commit. Modal reverts to QUOTA_EXCEEDED-only predicate; the
unhandled FEATURE_NOT_AVAILABLE / FEATURE_LIMIT 422s fall back to
the page's normal error display (no regression — just less polished
UX). Add Branch button shows for everyone (matches pre-A12.6 UX).

## Risks
- **Hook cache lag (5min)** could delay a brand seeing a newly
  granted/revoked override. Acceptable; admin can ask the brand to
  hard-refresh.
- **Profile page first paint** before hook resolves: button shows
  optimistically. Worst case Free brand sees the button for ~500ms,
  clicks it, queues a branch row, hits Save, sees the modal. No
  data loss; clean failure path.
- **Modal copy** for FEATURE_NOT_AVAILABLE uses the backend's
  `error.message` directly which is human-readable per the gate's
  `requireFeature` helper. Acceptable copy quality.
- **No new design tokens** (per Window B sequencing rule). All
  classes reuse existing Tailwind/wave2 palette.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Boot the brand-web dev server locally and load:
   - /dashboard/settings/profile (visual smoke of the conditional button)
   - /dashboard/settings/subscription (sanity-check the entitlements payload)
3. gov-check exit 0.
