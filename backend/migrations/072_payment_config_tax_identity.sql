-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 072 — Wave 1 commit 1: payment_config tax + identity columns
--
-- Centralizes every tax/identity value that was hardcoded or absent into
-- admin-controllable singleton config. Wave 2/3 will read these to apply
-- GST on Protection Fee + Commerce Commission, deduct TCS from brand
-- settlement, and generate proper tax invoices.
--
-- All columns are additive + idempotent (ADD COLUMN IF NOT EXISTS).
--
-- Contract: features/wave1-tax-config-foundation/.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE payment_config
  ADD COLUMN IF NOT EXISTS gst_pct                     numeric(5,2) NOT NULL DEFAULT 18.00,
  ADD COLUMN IF NOT EXISTS tcs_pct                     numeric(5,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS tcs_active                  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tcs_active_from_date        date,
  ADD COLUMN IF NOT EXISTS platform_gstin              varchar(15),
  ADD COLUMN IF NOT EXISTS platform_business_name      varchar(255),
  ADD COLUMN IF NOT EXISTS platform_business_address   text,
  ADD COLUMN IF NOT EXISTS platform_state_code         varchar(2),
  ADD COLUMN IF NOT EXISTS invoice_prefix_subscription varchar(20) NOT NULL DEFAULT 'INF-SUB',
  ADD COLUMN IF NOT EXISTS invoice_prefix_commerce     varchar(20) NOT NULL DEFAULT 'INF-COM';

COMMIT;
