# billing-quota-preflight — Phase A12.1.5

> Closes the UX gap founder caught after A12.1: the quota gate fires
> at form submit, after brand fills out the entire campaign form. The
> popup should fire the moment they click "+ New campaign" so no work
> is wasted.

## What ships

**Backend — new endpoint + shared evaluator**
- Extracts `evaluateQuota(req, action)` helper from the quotaCheck
  middleware. Returns the quota state as JSON without throwing.
  Middleware now calls evaluateQuota internally + throws on
  `would_block`; behaviour unchanged.
- New `GET /v1/brands/me/quota-preflight?action=…&campaign_id=…`
  endpoint (brand-authenticated). Returns:
  ```json
  { success: true, data: {
      action, feature_key, would_block, used, limit,
      current_tier, upgrade_to
  }}
  ```
- Valid actions: `createCampaign`, `createProduct`, `createSet`,
  `inviteInfluencer`. Same 4 the middleware gates.

**Frontend — preflight wired on entry buttons**
- `brandApi.quotaPreflight(action, params={})` in `Packages/brand-web/lib/api.js`.
- `/dashboard/campaigns` page: 2 "+ New campaign" entry buttons now call
  `goCreate()` which preflights → shows QuotaWallModal immediately if
  blocked → otherwise navigates to `/dashboard/campaigns/new`.
- `/dashboard/products` page: 3 "+ Add product" entry buttons now call
  `openCreateProduct()` which preflights → shows QuotaWallModal if
  blocked → otherwise opens the add-product modal as before.
- Both pages render the existing QuotaWallModal component at page root.
- "Fail-open" on preflight error (transient API hiccup): just opens
  the form/modal so the brand isn't blocked; the submit-time gate
  catches any real over-quota state.

## Out of scope
- `+ Add set` and "Invite influencer" buttons inside the campaign
  creation wizard (`/dashboard/campaigns/new`). These are nested
  inside the create flow; the existing submit-time popup
  (already wired in A9 via `showFromResponse`) fires immediately on
  click → no wasted work beyond the modal itself.
- Boolean-feature preflights (e.g. "is bulk_outreach allowed on my
  tier?"). Comes with each A12.2+ contract that wires a feature gate.
- New migration. None needed.

## Files
- `backend/src/middleware/quotaCheck.js` — extracted `evaluateQuota`.
- `backend/src/controllers/subscription.controller.js` — `quotaPreflight` controller fn.
- `backend/src/routes/brand.routes.js` — 1 new route mount.
- `Packages/brand-web/lib/api.js` — `brandApi.quotaPreflight()` method.
- `Packages/brand-web/app/dashboard/campaigns/page.js` — wire 2 entry buttons + render modal.
- `Packages/brand-web/app/dashboard/products/page.js` — wire 3 entry buttons (already renders modal).
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING — Vercel redeploys brand-web; Render redeploys backend (one new endpoint mounted). No DB migration. No mobile.
- Backward compatible: submit-time gate unchanged; preflight is additive UX layer above it.
- Fail-open posture: any error in preflight (network, timeout, 500) defaults to opening the form. The real gate at submit time still enforces.
