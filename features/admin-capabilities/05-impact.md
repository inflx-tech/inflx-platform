# Impact Analysis — Admin Capabilities (B-2)

> Terse verdict: layered access-control change — additive migration + a new middleware applied
> across the admin route surface; base roles preserved, superadmin can't be locked out.

## Affected files
- backend: migration 109_admin_capabilities.sql (NEW); config/adminCapabilities.js (NEW);
  middleware/auth.js (requireCapability); admin.controller.js (user CRUD + me + catalog);
  routes/admin.routes.js + adminSections.routes.js + returns.routes.js + marketingAdmin.routes.js +
  referralAdmin.routes.js (section guards → requireCapability; superadmin-only writes unchanged).
- web: app/admin/layout.js (nav scoping), app/admin/users/page.js (caps UI), lib/api.js.
- mobile: none.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | /admin/me | NEW (caller caps) | admin nav scoping |
| GET | /admin/capabilities | NEW (catalog) | users page checkboxes |
| POST/PATCH | /admin/users[/:id] | create/update caps+role+active (superadmin) | users page |
| (many) | /admin/<section>/* | guard → requireCapability('<section>') | all admin sections |

## Affected workflows (regression surface)
- Admin nav-sweep + role-gate specs (qa/web/admin/*) — must stay green. Confirmed GREEN.
- All admin section endpoints — superadmin bypass keeps superadmin-run tests passing.

## Migration / deploy / OTA impact
- Migration 109 (additive: capabilities[] + active + backfill) must be APPLIED TO PROD before/with
  the code (the middleware reads these columns). No OTA. Backend + web → push.

## Risk notes
- Access-control change: tightens scoping. Superadmin bypass + all-caps backfill prevents lockout.
- Capability setters superadmin-only; caps validated → no escalation.
- Follow-up: make deactivation global (currently enforced on capability-gated routes; extend to
  /admin/stats + user-mgmt). Reviewer-flagged, low severity.
