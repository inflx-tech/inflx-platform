# billing-admin-ui — admin pages for L1 tiers + L3 categories + sub queue + invoices (Phase A7-admin)

> **Phase A7 of the INFLX 3-Layer Revenue Model — admin half.**
> Brand-web pages stay deferred until Window B foundation merges;
> admin UI ships now because it's not in the redesign scope (founder
> direction 2026-05-23: "we are not planning any UI/UX change" for
> admin). All four pages mirror the existing `/admin/escrow-fees`
> styling pattern — no new visual design surface introduced.

## What ships

### 4 backend endpoint sets (all under /admin)
- `GET   /admin/subscription-tiers` — any admin
- `PATCH /admin/subscription-tiers/:tierKey` — superadmin
- `GET   /admin/categories` — any admin
- `POST  /admin/categories` — superadmin
- `PATCH /admin/categories/:categoryKey` — superadmin
- `DELETE /admin/categories/:categoryKey` — superadmin
- `GET   /admin/subscriptions?status=&tier_key=&limit=&offset=` — any admin
- `GET   /admin/subscription-invoices?status=&tier_key=&brand_id=&since=&limit=&offset=` — any admin

Mutation endpoints (PATCH/POST/DELETE on tiers + categories) require
`superadmin` — these change platform-wide fee behaviour. Read-only +
filter endpoints (subscriptions queue + invoices) accept any admin
role, per the admin role-gate convention (feedback_admin_role_gates.md).

### 4 brand-web admin pages
- `/admin/pricing/tiers` — list/edit 4 subscription tiers (name, price, 4 limits, active, description). Inline edit; `Save Changes` PATCHes one row at a time.
- `/admin/pricing/categories` — list/add/edit/delete category rows. Per-row inline edit. Add via top form. Delete with confirmation.
- `/admin/subscriptions` — read-only queue of brand_subscriptions joined to subscription_tiers + brands. Filter by status + tier.
- `/admin/billing/invoices` — read-only invoice list with status / tier / brand_id filters + running "paid (filtered)" sum.

### Nav updates
`Packages/brand-web/app/admin/layout.js`:
- Adds two entries under FINANCE: `Active Subs`, `Sub Invoices`.
- Adds new section `PRICING`: `Tiers (L1)`, `Categories (L3)`.

### Tests
- Backend `backend/tests/subscription.test.js` extended with 7 admin assertions:
  - GET tiers returns the 4 seeded rows.
  - PATCH tier as superadmin updates price+limits.
  - PATCH tier as reviewer 403.
  - GET categories returns seeded rows; salon Path A = 9.
  - PATCH category Path B updates.
  - POST + DELETE category lifecycle.
  - GET subscriptions returns joined rows after a brand upgrade.
  - GET invoices with status filter.
- Playwright `qa/web/admin/nav-sweep.spec.ts` — 4 new routes added; the existing breadth-net spec proves each loads cleanly.

## Out of scope (deferred)
- Brand-side pages (`/dashboard/subscription`, `/dashboard/billing`, quota-wall modal) — gated on Window B foundation.
- HTML-mockup-locked workflow — per founder direction "no UI/UX change", admin pages mirror the existing `/admin/escrow-fees` visual; lock attestation reflects that.
- Razorpay live mandate webhook — A6.5 follow-up.

## Files
- `backend/src/controllers/categories.controller.js` (new)
- `backend/src/controllers/subscription.controller.js` (extended)
- `backend/src/routes/admin.routes.js` (extended)
- `Packages/brand-web/lib/api.js` (extended adminApi)
- `Packages/brand-web/app/admin/layout.js` (nav updates)
- `Packages/brand-web/app/admin/pricing/tiers/page.js` (new)
- `Packages/brand-web/app/admin/pricing/categories/page.js` (new)
- `Packages/brand-web/app/admin/subscriptions/page.js` (new)
- `Packages/brand-web/app/admin/billing/invoices/page.js` (new)
- `backend/tests/subscription.test.js` (extended)
- `qa/web/admin/nav-sweep.spec.ts` (4 routes added)
- This contract.
