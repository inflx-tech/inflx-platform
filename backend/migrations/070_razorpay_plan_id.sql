-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 070 — Phase A6.5 + A13: real Razorpay Subscriptions wiring.
--
-- 1. Add razorpay_plan_id column on subscription_prices. Admin pastes the
--    Razorpay-dashboard-generated plan_NXyz123… IDs into this column per
--    (tier × billing_period) row, via the existing
--    /admin/pricing/tiers/[tier_key] Section B editor.
--
--    NULL = not yet configured → controller returns 422 ADMIN_CONFIG_MISSING
--    gracefully (no 500s; brand sees "Subscription setup is in progress").
--
-- 2. Partial unique index on subscription_invoices(brand_subscription_id,
--    razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL. This makes
--    the subscription.charged webhook handler idempotent — duplicate
--    webhook deliveries with the same payment_id silently no-op.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).
--
-- Contract: features/billing-razorpay-live/.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE subscription_prices
  ADD COLUMN IF NOT EXISTS razorpay_plan_id varchar(40);

CREATE INDEX IF NOT EXISTS idx_sub_prices_razorpay_plan
  ON subscription_prices (razorpay_plan_id)
  WHERE razorpay_plan_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_sub_invoices_brand_payment
  ON subscription_invoices (brand_subscription_id, razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

COMMIT;
