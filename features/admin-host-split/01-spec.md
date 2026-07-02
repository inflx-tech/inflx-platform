# Feature Spec — Admin Host Split (B-1, Option A)

> Serve admin only on admin.inflx.in; stop serving /admin on the public host.
> Locked decision (project_admin_url_roles_decision). Option A = alias domain + host routing.

## Problem / goal
Admin currently lives at inflx.in/admin (same host as the brand app), gated only by a
cookie-existence check. Founder chose Option A: give admin its own host (admin.inflx.in) and
keep it off the public site. (Domain already added in Vercel + DNS by founder; admin.inflx.in
resolves and serves the app.)

## Scope
- In scope: Next.js middleware host routing — on admin.inflx.in serve only admin (+ /login);
  on inflx.in redirect /admin → admin.inflx.in; localhost/preview unchanged (dev/QA safe).
- Out of scope (follow-up): cryptographic edge auth gate (JWT verify at the edge) — backend
  already enforces admin auth on every API call; extracting admin into its own app (Option C).

## Surfaces touched
- Packages/brand-web/middleware.js only. No backend (CORS already allows *.inflx.in). No DB.

## Data / contracts
- No API/schema change. Backend CORS regex `^https?://(.*\.)?inflx\.in$` (app.js:46) already
  permits admin.inflx.in.
- Redirects are 307 (temporary). matcher: ['/', '/dashboard/:path*', '/admin/:path*'].

## Non-functional
- No lockout / no redirect loop (safety-reviewed across all host×path combos). /login kept OUT
  of the matcher — that invariant terminates the /→/admin→/login chain on the admin host.
- Dev/QA/preview hosts retain the exact prior cookie-gate behavior.
