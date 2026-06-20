# Feature Spec — Admin Capabilities / Permissions (B-2)

> Superadmin creates staff admins and scopes each to only certain admin sections,
> enforced at BOTH API and nav. Locked decision (memory: project_admin_url_roles_decision).
> Approved in-session by founder ("lets complete B2").

## Problem / goal
Today there are only 3 fixed admin roles (superadmin/reviewer/finance) and the nav shows
everything to every admin (only the API 403s). The founder wants granular, per-section
access: e.g. a "marketing only" or "payouts only" admin. Goal: a capabilities model layered
on the base roles — superadmin assigns a set of allowed sections per admin, enforced at the
API and reflected in the nav, plus admin lifecycle (edit caps, deactivate).

## Scope
- In scope: capabilities column + catalog; requireCapability middleware (per-request DB load;
  superadmin bypass; inactive→403); convert section route guards to requireCapability across
  admin.routes.js + adminSections/returns/marketing/referralAdmin route files; admin Users UI
  (create/edit/deactivate + capability checkboxes); nav scoping; GET /admin/me + /admin/capabilities.
- Out of scope: B-1 host split (separate); putting capabilities into the JWT (we load per-request).

## Surfaces touched
- backend (middleware, admin.controller, admin + section route files, new config catalog, migration 109).
- brand-web admin (layout nav scoping, users page). No mobile.
- Roles: admin (superadmin manages; reviewer/finance + new scoped admins consume).

## Data / contracts
- Migration 109: admin_profiles.capabilities text[] default '{}' + active bool default true;
  backfill by base role (superadmin→all; reviewer→approval/content sections; finance→money sections).
- Capability catalog (20 keys) in backend/src/config/adminCapabilities.js + GET /admin/capabilities.
- requireCapability(capKey): role==='admin'; fresh DB load of admin_role/capabilities/active;
  superadmin bypass; inactive or missing cap → 403.
- New: GET /admin/me, GET /admin/capabilities, PATCH /admin/users/:id (superadmin).

## Non-functional
- Superadmin never locked out (bypass + backfill all caps).
- No privilege escalation: capability/role/active setters are superadmin-only; caps validated against catalog.
- Backward compatible: base roles preserved; existing reviewer/finance reach unchanged via default caps.
- Known follow-up: deactivation (active=false) is enforced on all capability-gated routes; extend to the
  remaining requireAnyAdminRole/requireAdminRole routes (/admin/stats, user-mgmt) so deactivation is global.
