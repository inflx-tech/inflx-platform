# 01 — Spec: Order Fulfillment — Admin oversight (Unit 3)

**Contract:** `order-fulfillment-admin` (UI-governed, brand-web admin + backend).
Locked mockup `04-preview/mockups/admin-orders.html`. Founder: 'pls proceed' 2026-06-17.
Finishes Phase 1 of the Order Fulfillment Engine.

## Build
- **Backend (new):** `adminOrders.controller.js` — `GET /admin/orders` (all brands,
  filter status/q, paginated; returns customer/brand/creator/courier/AWB/commission/
  timestamps) + `PATCH /admin/orders/:id/status` (admin override of any order's status
  + courier/tracking + cancel; notifies follower). requireAnyAdminRole. Routes in
  admin.routes.js.
- **Commission reversal on refund:** `returns.controller.adminMarkRefunded` now reverses
  the influencer's HELD (unconfirmed) commission (decrement pending_balance + total_earned)
  + marks the transaction `refunded`. (The Unit-1 cleanup item; cron already skips refunded.)
- **Admin UI (new):** `app/admin/orders/page.js` (+ nav 📦 Orders) — order list + status
  filter + search; expand → ship-to / courier+AWB+track link / commission state, and
  Admin controls (override-status select + courier/AWB + Apply, Cancel order).

## Notes
- Refunds proper run through the existing admin Returns flow (`/admin/returns`); this
  screen surfaces order oversight + status override + cancel. Navy/amber admin theme.

## Acceptance
- Admin sees all online orders, can override status / cancel (follower notified); a
  refund reverses the held commission. backend node --check clean; brand-web build
  exit 0; `pnpm qa` GREEN gate 0. No migration. released=false until founder verify.
