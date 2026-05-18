# Feature Spec — Admin approvals: approve a pending brand

> Contract A1 of Area A (L2 web workflow coverage). Step 2.
> Implementation is GATED on `lock.json.approved = true`.

## Problem / goal
Admins must be able to clear the approval queue. The core, highest-
value admin workflow is: an authenticated admin opens the approval
queue, sees a pending brand, and approves it — with the queue
reflecting the result. This workflow currently has zero automated
coverage.

## Scope
- In scope: the **approve a pending brand** path on `/admin/approvals`
  (brands tab), including the admin role gate that protects it.
- Out of scope (separate contracts):
  - A2 — role gate negative path (non-admin → /login)
  - A3 — reject-with-reason path
  - A4 — upload workflows
  - A5 — admin navigation regression sweep

## Surfaces touched (verified)
- App: **brand-web** (Next 14, port 3002). NOTE: the separate
  `Packages/admin-web` is a thin login+dashboard app and does NOT
  host approvals — the admin surface is brand-web `/admin/*`.
- Route: `/admin/approvals`
- Role: `admin` (any admin_role) — enforced by `app/admin/layout.js`

## Data / contracts (observed, no changes)
- Auth gate (`app/admin/layout.js`): reads `localStorage.inflx_user`
  + `inflx_token`; if `!user || user.role!=='admin' || !token` →
  `router.push('/login')`. Also calls `POST /auth/refresh` and
  `GET /admin/stats` (sidebar badge).
- Queue load: `GET /admin/queue/brands`, `GET /admin/queue/influencers`
- Approve action: `PATCH /admin/brands/:id/status` body `{ status:'approved' }`
  → success toast `"Brand approved successfully"` + queue reload.

## Non-functional
- Deterministic test: APIs stubbed via Playwright route interception;
  admin session seeded via `addInitScript` localStorage (no live
  backend, no real OTP) — same pattern as the brand-web-auth reference.
- Failure mode in scope: PATCH returns non-success → error toast,
  row remains pending (asserted as an edge workflow).
