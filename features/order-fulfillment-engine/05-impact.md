# 05 — Impact: Order Fulfillment Engine (Unit 1)

**Verdict: additive migration + backend. Fixes a live brand-orders bug + a money-
correctness gap. No UI in this unit.**

## Mechanics
- Migration 105: enum ADD VALUE (idempotent, non-transactional per precedent) +
  ADD COLUMN IF NOT EXISTS ×5 on follower_orders. Additive — existing rows default
  to NULL on the new columns; existing statuses unchanged.
- `transaction.controller.updateOrderStatus`: VALID_STATUSES expanded; per-step
  timestamp via a whitelisted column name (no SQL injection — fixed map); courier/
  tracking COALESCE-updated; notifications per step.
- `brand.controller.listBrandOrders`: LEFT JOIN follower_addresses + composed
  delivery_address; new columns surfaced. Fixes the missing-column error.
- `commission-confirm.job`: two NOT EXISTS guards (cancelled order / active-or-
  successful return) added to the release query.

## Blast radius
- Brand order status + list, commission cron. No change to order CREATION/payment.
- Deploy-class: production-impacting — **migration 105 must be applied to prod FIRST**
  (explicit founder go), then backend push. Render auto-deploys backend.
- Risk: low-moderate. Enum ADD VALUE is the only schema-sensitive bit — idempotent +
  precedent. Migration verified in qa:db in-chain before prod.
- Money: the cron change is strictly MORE conservative (holds commission in more
  cases) — it can never wrongly PAY; worst case it over-holds a commission whose
  return is later rejected (self-heals next run).
