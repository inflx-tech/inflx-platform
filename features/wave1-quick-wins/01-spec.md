# Feature Spec — Wave-1 Quick Wins (audit bug-fixes)

> Contract for 5 low-risk, well-specified fixes surfaced by the 2026-06-17 full audit.
> Approved for deploy in-session by the founder after QA-green + reviewer pass.

## Problem / goal
Five independent defects found during the platform audit, bundled because each is a
small, self-contained fix touching a different file (no overlap):

- **A-1** — Web users are logged out ~every 15 minutes. The login page wrote the
  session-gate cookie with `max-age=900` while the rest of the app used 30 days;
  the route middleware then evicts the session even though the 30-day refresh token
  is still valid.
- **A-2** — The marketing homepage carries an OLD embedded brand login/registration
  widget (no role handling, registers brands with NO location). The canonical login
  is the separate `/login` route. Two divergent registration paths produce different
  brand records.
- **B-3 / G-1** — The admin Payment Config screen shows GST %, TCS settings,
  platform GSTIN/identity/invoice prefixes, and T3 release day/time as editable, but
  the read service never fetched those columns and the write path silently dropped
  them — so GST was pinned to an 18% fallback and T3 hardcoded to 30d/03:00 IST.
- **C-1** — The "Marketplace Categories (L3)" admin CRUD controller was never mounted,
  so `/admin/pricing/categories` 404'd end-to-end (table only editable via raw SQL).
- **E-5** — Media gallery thumbnails rendered half-cut (`object-fit:cover` in a fixed
  140px box).

## Scope
- In scope: the 5 fixes above, code-only, no schema changes (all DB columns already exist
  from migrations 072/074).
- Explicitly out of scope: the landing-page re-messaging/recolor (A-3), admin host split
  (B-1), capabilities roles (B-2), and all larger builds (returns, ledger, dashboard reorg,
  campaign redesign) — those are separate contracts.

## Surfaces touched
- Apps: brand-web (login, homepage, dashboard gallery, admin payments + categories), backend.
- Roles involved: brand (login/landing/gallery), admin/superadmin (payment config, categories).

## Data / contracts
- New or changed tables/columns/migrations: NONE. Columns referenced (gst_pct, tcs_pct,
  tcs_active, tcs_active_from_date, platform_gstin, platform_business_name,
  platform_business_address, platform_state_code, invoice_prefix_subscription,
  invoice_prefix_commerce, tranche_3_release_after_days, tranche_3_release_time_ist)
  already exist (migrations 072, 074).
- New/changed API endpoints: mounts the existing categories controller —
  `GET /admin/categories` (any admin), `POST /admin/categories` (superadmin),
  `PATCH /admin/categories/:categoryKey` (superadmin),
  `DELETE /admin/categories/:categoryKey` (superadmin). PATCH `/admin/config/payments`
  now forwards the 12 previously-dropped fields.
- Money/units: payment-config values (GST/TCS/T3 timing) now actually persist and are
  read by tax.service — they feed invoicing + tranche-release timing. No behavior change
  until a superadmin edits them; defaults preserved.

## Non-functional
- Auth/role gates: categories writes restricted to superadmin; reads to any admin.
- Failure modes: paymentConfig keeps safe hardcoded fallbacks if the DB read fails, so
  a missing column or read error degrades to prior defaults rather than crashing.
