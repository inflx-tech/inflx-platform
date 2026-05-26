# 06-diff — ui-polish-feature-gates

**Before:** the QuotaWallModal's `isQuotaError` predicate only fired
on `QUOTA_EXCEEDED`. The five backend per-feature gates shipped
across A12.2–A12.6 throw three distinct codes:

| Code | Where | Carries |
|------|-------|---------|
| QUOTA_EXCEEDED | quotaCheck middleware (A12.1) | used/limit/upgrade_to |
| FEATURE_NOT_AVAILABLE | requireFeature helper (A12.3/A12.4/A12.5/A12.6) | feature_key/upgrade_to |
| FEATURE_LIMIT | openGroupMatches niches_limit (A12.2) | used/limit/upgrade_to |

Brand pages hit FEATURE_NOT_AVAILABLE / FEATURE_LIMIT and the
existing error toast / inline banner appeared, but the modal —
which has the upgrade chips + "View plans" CTA — did not. The
upgrade path was effectively buried.

Additionally, the brand profile editor's **"+ Add Branch"** button
was visible to every tier. Free/Growth brands could tap it, fill
in branch fields, hit Save, and only THEN get the 422 (and even
that 422 didn't open the modal because of the predicate gap above).

**After:** three changes.

**1. QuotaWallModal predicate now matches all three codes.** Every
page that already routes its 422 responses through
`showFromResponse(res)` (campaigns/page, campaigns/new/page,
products/page) now pops the modal for the per-feature gates with
zero per-page wiring. The modal's body adapts:

- QUOTA_EXCEEDED / FEATURE_LIMIT: keeps the used/limit summary
  rows (these codes carry numeric details).
- FEATURE_NOT_AVAILABLE: drops the used/limit rows (binary code,
  no numbers to show); cleaner copy.

Titles:

- QUOTA_EXCEEDED → "Plan limit reached" (unchanged).
- FEATURE_NOT_AVAILABLE → "Feature not on your plan".
- FEATURE_LIMIT → "Feature limit reached".

**2. New `useEntitlements()` hook** at
`Packages/brand-web/lib/useEntitlements.js`. Consumes the existing
`GET /v1/brands/me/subscription` which already returns
`entitlements` + `tier_key` via `entitlementsService.getEntitlementsPlain`.
Module-level 5min cache dedupes across components. Exposes
`has(key)`, `quotaFor(key)`, `configFor(key)` helpers so any client
component can gate visibility on a feature.

**3. "+ Add Branch" button conditional on `multi_branch_support`.**
- Pro/Enterprise: button visible as before.
- Free/Growth: hint chip in its place — *"Multi-branch is on Pro
  and Enterprise plans · View plans →"* linking to
  /dashboard/settings/subscription.
- Loading state: optimistic render (button visible) — fail-safe
  because the backend gate (A12.6) still blocks the save and the
  newly-extended modal pops.

**Other proactive hides intentionally deferred:** the campaigns/new
wizard's open-group publish button (bulk_outreach +
open_group_broadcast) and the influencer-search advanced filters
(search_filters_advanced) are gated reactively via the now-extended
modal. Hiding them proactively requires deeper changes inside those
wizards and is a follow-up. Backend gates + modal pop is acceptable
v1.

**Defensive behaviour:**
- Hook fetch failure → renders the button optimistically; backend
  gate is the safety net.
- Modal predicate unchanged for unknown codes → page-level error
  fallback still kicks in (`if (!showFromResponse(res)) setErr(...)`).
- 5min hook cache → brands see entitlement changes within 5min of
  admin override save; admin can ask for hard-refresh for instant
  feedback.

**Verified locally:** pnpm qa 76/76 GREEN; manual smoke on
/dashboard/settings/profile shows the conditional button; modal
preview confirms the three-code rendering.
