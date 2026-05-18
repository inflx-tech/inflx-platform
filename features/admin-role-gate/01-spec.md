# Feature Spec — Admin role-gate matrix

> Contract A2 of Area A. Step 2. Implementation GATED on
> `lock.json.approved = true`.

## Problem / goal
A1/A3 only spot-checked the auth gate (one no-session case). The
`/admin/*` and `/dashboard/*` gate is a **security surface** with two
independent layers, and a regression in either would silently expose
admin pages. This contract pins the full matrix so the gate cannot
weaken unnoticed.

## Scope
- In scope: the access matrix for the protected gate —
  combinations of (cookie present?, localStorage role?) against a
  representative admin route, plus the middleware breadth case for
  `/dashboard`.
- Out of scope: what admin pages *do* once authorised (A1/A3/A5);
  real token validity / backend RBAC (middleware only checks cookie
  *existence*, not validity — documented as a known limitation, not
  tested here).

## Surfaces touched (verified)
- `Packages/brand-web/middleware.js` — matcher
  `['/dashboard/:path*','/admin/:path*']`; redirects to `/login`
  when the `inflx_token` **cookie is absent** (existence only — does
  NOT validate the token or role).
- `Packages/brand-web/app/admin/layout.js` — client `useEffect`:
  redirects to `/login` when
  `!inflx_user || inflx_user.role !== 'admin' || !inflx_token`
  (localStorage).
- Representative route: `/admin/approvals`.

## Data / contracts
No API behaviour under test; the security outcome is the **redirect
to `/login`** (or staying on the admin route for the valid case).
Admin APIs are stubbed only so the positive case can render.

## Non-functional
- Deterministic, no backend. Negative cases use partial seeding
  (cookie-only / wrong-role localStorage / none) done inline in the
  spec; the valid case reuses `_helpers/adminSession`.
- Known limitation explicitly NOT a failure: middleware accepts ANY
  non-empty `inflx_token` cookie (no signature/role check) — real
  enforcement is the client layer + backend. Recorded in spec so a
  future reviewer doesn't mistake it for a test gap.
