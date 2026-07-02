# 06 — Implementation / diff notes (Admin Host Split, B-1 Option A)

Single-file middleware change; founder-driven infra. Safety-reviewed; QA GREEN.

## What was implemented
- Packages/brand-web/middleware.js rewritten for host-aware routing:
  - admin.inflx.in → serves only admin (+ /login); '/' → /admin; /dashboard* → inflx.in.
  - inflx.in / www.inflx.in → /admin* redirected to admin.inflx.in.
  - all other hosts (localhost, previews) → unchanged cookie-gate behavior (dev/QA safe).
  - matcher: ['/', '/dashboard/:path*', '/admin/:path*']; /login deliberately NOT matched.

## Reviewer findings
- SAFE across all 15 host×path combinations: no redirect loops, no lockout, no open-redirect,
  QA/dev behavior byte-for-byte preserved. Invariant to protect: keep /login out of the matcher.
- Non-blocking: middleware checks cookie existence only (pre-existing; backend enforces real auth).

## What diverged / deferred
- Cryptographic edge auth gate (JWT verify in middleware) — follow-up; backend already enforces.
- Option C (extract admin into its own app) — future, if full code isolation wanted.

## What to check after deploy
- admin.inflx.in/admin → serves admin; admin login works there.
- inflx.in/admin → 307 to admin.inflx.in/admin.
- inflx.in/dashboard + inflx.in landing → unchanged.
