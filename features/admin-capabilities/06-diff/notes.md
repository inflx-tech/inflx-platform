# 06 — Implementation / diff notes (Admin Capabilities, B-2)

Access-control feature; the UI-governed touches are the admin nav + users page (standard admin
patterns, no new mockup). Approved in-session ("lets complete B2").

## What was implemented
- Migration 109: admin_profiles.capabilities text[] '{}' + active bool true; role backfill
  (superadmin→all 20 keys; reviewer→approval/content sections; finance→money sections). Idempotent.
- backend/src/config/adminCapabilities.js: 20-key catalog + role→default-caps map + validators.
- middleware requireCapability(capKey): role==='admin'; per-request DB load of
  admin_role/capabilities/active; superadmin bypass; inactive or missing cap → 403.
- Guards converted to requireCapability across admin.routes.js AND the four section route files
  (adminSections/returns/marketing/referralAdmin) — so every gated section enforces at the API,
  not just nav. Superadmin-only writes left as requireAdminRole('superadmin').
- admin.controller: createAdminUser (role+caps), updateAdminUser, getMe, getCapabilityCatalog;
  getAdminUsers returns caps+active.
- app/admin/users: capability checkboxes (from catalog) + edit + deactivate/reactivate.
- app/admin/layout: fetch /admin/me, render only nav items the admin has capability for.

## Reviewer findings + resolution
- Security review flagged that 4 sections (sections/returns/marketing/referrals) had routes in
  separate files still on requireAnyAdminRole — nav-gated but API-open (returns = refund surface).
  FIXED in this same change: those 4 files converted to requireCapability before release.
- Confirmed: superadmin never locked out; no privilege escalation (setters superadmin-only,
  caps validated); migration additive/idempotent. pnpm qa GREEN.

## What diverged / deferred
- Deactivation is enforced on all capability-gated routes; the generic requireAnyAdminRole/
  requireAdminRole routes (/admin/stats, user-mgmt) don't yet check active — FOLLOW-UP to make
  deactivation global (low severity).

## What to check after deploy (migration 109 applied first)
- Superadmin → Users → create a "marketing only" admin; that admin sees only Marketing in nav and
  gets 403 on other section APIs; superadmin still sees/does everything.
