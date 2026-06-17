# 05 — Impact: Admin oversight (Unit 3)

**Verdict: additive admin endpoints + admin page + a commission-reversal on refund.
No migration. No change to order CREATION/payment.**

## Mechanics
- NEW `adminOrders.controller.js` (listOrders + updateStatus) + 2 admin routes
  (requireAnyAdminRole). Read + status-override only.
- `returns.controller.adminMarkRefunded`: + reverse unconfirmed commission
  (pending_balance/total_earned) + mark txn refunded. Guarded: only when not yet
  confirmed and commission > 0; GREATEST(0, …) floors at zero.
- NEW `app/admin/orders/page.js` + nav link.
- `lib/api.js`: adminApi.listOrders + updateOrderStatus.

## Blast radius
- New admin surface + one refund-path addition. Existing brand fulfilment + follower
  tracking unaffected (same status backend). No schema change.
- Deploy-class: production-impacting (Render backend + Vercel brand-web). No migration,
  no mobile OTA. released=false until founder verify.
- Money: the reversal is conservative (only claws back UNCONFIRMED/held commission;
  never touches a withdrawn wallet) — it can only make payouts more correct.
