# 06 — Diff Notes: Admin oversight (Unit 3)

Locked reference: `../04-preview/mockups/admin-orders.html`.

## Implemented
- Backend: NEW adminOrders.controller (GET /admin/orders all-brands list + PATCH
  /admin/orders/:id/status override/cancel, requireAnyAdminRole) + admin.routes wiring.
- returns.controller.adminMarkRefunded: reverses the influencer's held (unconfirmed)
  commission (pending_balance + total_earned ↓) + marks the transaction refunded — the
  Unit-1 commission-cleanup item. Pairs with the cron's refund-skip.
- Admin UI: NEW app/admin/orders/page.js (list + status filter + search; expand →
  ship-to/courier/AWB/track/commission + Admin controls: override-status + courier/AWB
  + Apply, Cancel) + nav 📦 Orders + adminApi.listOrders/updateOrderStatus.

## Faithful to mockup
Orders table, status filter chips, expanded admin controls, navy/amber theme. Refund
proper stays in the existing Returns queue (noted in the UI).

## Verification
- backend node --check (adminOrders.controller, admin.routes, returns.controller) clean.
- brand-web build exit 0; pnpm qa GREEN gate 0. Phase 1 COMPLETE (Units 1-4).
