# wave1-admin-categories-return-window

> Second commit of Wave 1. Surfaces the L3 commerce-commission rate
> editor + per-category return-window admin UI (gap #6 from the
> revenue audit). The other 3 admin pages (payments settings,
> brand detail, influencer detail) are deferred to a follow-up
> commit so this small change lands cleanly.

## What ships

**Backend — `categories.controller.js`**
- `list` endpoint SELECT extended to surface `return_window_days`.
- `update` endpoint `allowed` whitelist extended to accept
  `return_window_days` (int 0–365 enforced at the column level via
  the existing M073 schema; client-side validation in the admin UI
  page also gates 0–365).

**Frontend — `/admin/pricing/categories`**
- New "Return win (d)" column between Path C and Active.
- Editable when row is in edit mode (number input, 0–365).
- Read-only displays `30d` style.
- "Add Category" form gains a `return_window_days` input (defaults
  to '30').
- Save validates per-category window alongside the path % values.

## Verify-twice

- M073 has applied on prod (`categories.return_window_days` column
  exists, defaulted to 30 on all 16 seed rows).
- pricing.service already reads per-category window via
  `getReturnWindowForCategory` (Wave 1 commit 1). Wave 3 cron will
  consume it.
- The categories page only edits via the existing /admin/categories
  CRUD endpoints; no new route. Just one extra field on the
  existing PATCH whitelist.

## Out of scope

- Admin UI surfaces for the other Wave 1 fields:
  - `/admin/settings/payments` — needs GST/TCS/T3-time/identity inputs
  - `/admin/brands/[id]` — needs commerce_commission_override_pct field
  - `/admin/influencers/[id]` — needs tds_override_pct + tds_exempt
  These follow in a separate commit alongside (or before) Wave 2.

## Files

- `backend/src/controllers/categories.controller.js` — list SELECT
  + update allowed list.
- `Packages/brand-web/app/admin/pricing/categories/page.js` — new
  column + form fields.
- This contract.

## Non-functional

- Deploy posture: PRODUCTION-IMPACTING (Render redeploys backend
  with one extra SELECT column + Vercel redeploys brand-web with
  the new admin field). NO migration (M073 already live on prod).
- Backward compatible: existing rows have `return_window_days=30`
  by default (matches the prior global behaviour). Admin can edit
  per-category from here.
- pnpm qa 76/76 GREEN (no QA spec hits /admin/pricing/categories
  directly).
