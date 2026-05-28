-- 075_brand_withdrawals.sql
-- Wave 2 commit 2 — brand wallet withdrawal (admin-gated payouts).
--
-- Adds three things:
--   1. 'withdrawal' value on wallet_tx_type — the ledger entry for a brand
--      payout. Kept DISTINCT from 'payout', which getWallet attributes to
--      influencer tranche settlements (settled_balance). Reusing 'payout'
--      would wrongly inflate that figure. getWallet's existing FILTERs do
--      not match 'withdrawal', so the Available/Reserved/Settled breakdown
--      stays correct without change.
--   2. brand_withdrawal_status — richer than influencer withdrawal_status:
--      adds pending/queued/cancelled to model the admin approval gate + the
--      RazorpayX payout lifecycle.
--   3. brand_withdrawals — mirror of influencer_withdrawals MINUS TDS (a
--      brand withdrawing its own wallet balance is not a taxable payout).
--
-- Forward-only + idempotent. ALTER TYPE ... ADD VALUE is non-transactional
-- on some PG versions, so run-075.js executes it as a standalone statement
-- (split on the @@SPLIT@@ marker) BEFORE the table DDL. The new 'withdrawal'
-- value is NOT used within this migration, so there is no in-transaction-use
-- hazard.

ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'withdrawal';

-- @@SPLIT@@

DO $$ BEGIN
  CREATE TYPE brand_withdrawal_status AS ENUM
    ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS brand_withdrawals (
  id                   uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id             uuid                    NOT NULL REFERENCES brands(id),
  amount_requested     numeric(12,2)           NOT NULL,
  method               withdrawal_method       NOT NULL,
  upi_id               text,
  bank_account_no      text,
  bank_ifsc            varchar(12),
  account_holder_name  text,
  razorpay_payout_id   varchar(80),
  status               brand_withdrawal_status NOT NULL DEFAULT 'pending',
  failure_reason       text,
  created_at           timestamptz             DEFAULT now(),
  completed_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_brand_withdrawals_brand_status
  ON brand_withdrawals (brand_id, status);
