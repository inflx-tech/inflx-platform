# fix-tier-list-and-create-flow — Phase A10.5

> Repairs the silent-empty bug the founder caught on `/admin/pricing/tiers`
> (production-deployed but data-blind), and adds the missing "+ New tier"
> create flow with safe-defaults seeding.

## Root cause of the empty tier list (verify-twice)

`/admin/pricing/tiers` page calls `adminApi.listSubscriptionTiers()` →
`GET /v1/admin/subscription-tiers`. The handler `adminListTiers` has
existed in `subscription.controller.js` since commit `3920772`
(Phase A7-admin) — but the route was **never mounted** in any route
file. So the endpoint has been returning 404 silently since A7-admin
shipped. The same applies to `adminUpdateTier`, `adminListSubscriptions`,
and `adminListInvoices` — all 4 affected pages have been silently
broken on prod for ~2 days.

The page's `.catch` handler only catches thrown errors. The api.js
fetch wrapper does NOT throw on 404; it returns `{success: false,
error: {...}}` as a normal envelope. The page treated `res.data?.tiers`
as `undefined` → fell through to the "No tiers yet" empty state.

The Features catalog page worked because the features routes
(`/admin/features` etc.) WERE properly wired in A10.

## What ships in A10.5

### Wiring fix (5 admin routes now mounted)
Adds the missing admin route mounts in `backend/src/routes/admin.routes.js`:
- `GET    /admin/subscription-tiers`
- `POST   /admin/subscription-tiers`             ← new (A10.5)
- `PATCH  /admin/subscription-tiers/:tierKey`
- `GET    /admin/subscriptions`
- `GET    /admin/subscription-invoices`

All 5 use the existing controller handlers in `subscription.controller.js`.

### "+ New tier" flow
- **Button** added to the top-right of `/admin/pricing/tiers` next to "Manage features catalog".
- **Modal** opens with 3 inputs: tier_key (slug, lowercase letters/digits/underscores; client-side regex enforced), display name (2-80 chars), description (optional, ≤500 chars).
- **Save** calls `POST /admin/subscription-tiers` which:
  1. Validates input (422 on bad slug, conflict 409 on duplicate).
  2. INSERTs a tier row with safe defaults (₹0 monthly, all max_* quotas at 0, sort_order = max + 1, active = true).
  3. Seeds 13 `tier_features` rows for every active catalog feature (included=false, quota_value = catalog default for quota features, config = {}).
  4. Seeds 1 `subscription_prices` row at monthly ₹0.
  5. Wraps in a transaction; rolls back on any error.
- **On success** navigates directly to `/admin/pricing/tiers/[tier_key]` so admin lands in the 3-section editor to set price + flip features + enter quotas/configs.

### Page error surfacing
The list page now distinguishes:
- `res.success === false` → renders the actual `error.code` + `error.message` in a red banner.
- thrown exception → shown as "Load failed (thrown)" with the message.
- empty array AND no error → renders "No tiers found. Click + New tier to create one." (not the old "Run migration M061 to seed" which was misleading).

This pattern prevents the silent-empty failure mode that hid the routing bug for 2 days.

## Files
- `Packages/brand-web/app/admin/pricing/tiers/page.js` — rewritten with error surfacing + create modal.
- `Packages/brand-web/lib/api.js` — adds `adminApi.createSubscriptionTier`.
- `backend/src/controllers/subscription.controller.js` — adds `adminCreateTier` + exports it.
- `backend/src/routes/admin.routes.js` — wires 5 missing admin routes (4 pre-existing + 1 new).
- This contract.

## Out of scope
- The 3-section detail editor at `/admin/pricing/tiers/[tier_key]` — already exists from A10, untouched.
- Per-feature enforcement wiring — A12, founder-paced.
- Per-brand override — A14.

## Verify-twice catch I owe the founder
The fact that 4 admin endpoints have been live but unreachable since A7-admin is a real verify-twice failure on my side. The original A7-admin contract said "8 admin endpoints" but I only wired the 3 actually mounted (escrow_fee_tiers ones + features later). The subscription admin endpoints were defined and exported but no `router.get(...)` line was ever added. Adding nav-sweep tests for those routes only proved they RENDER on the page, not that the BACKEND endpoints behind them work — those tests stub the API permissively.
