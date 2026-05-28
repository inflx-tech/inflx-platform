-- 077_commerce_settlement_foundation.sql
-- Wave 3 commit 1 — commerce settlement foundation (Razorpay Route).
--
-- Additive + DORMANT: adds the brand payout-account fields + per-transaction
-- settlement columns. No behaviour change until the settlement wiring (Wave 3
-- commit 2) AND Razorpay Route is enabled on the account. Forward-only,
-- idempotent, safe to apply ahead of the code.
--
-- Note: the commission-release timer reuses the EXISTING
-- follower_transactions.return_window_ends_at (the commission-confirm cron
-- already reads it). Wave 3 commit 2 changes how that value is COMPUTED
-- (per-category window) rather than adding a redundant column.

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS razorpay_linked_account_id varchar(80),
  ADD COLUMN IF NOT EXISTS linked_account_status      varchar(24) NOT NULL DEFAULT 'not_created',
  -- Per-brand TCS gate: TCS is deducted from a brand's commerce settlement only
  -- when this is true (set by finance after verifying the brand crosses the
  -- ₹50L turnover threshold). The global payment_config.tcs_active is the master
  -- switch; this is the per-brand gate.
  ADD COLUMN IF NOT EXISTS tcs_applicable             boolean     NOT NULL DEFAULT false;

ALTER TABLE follower_transactions
  ADD COLUMN IF NOT EXISTS tcs_amount            numeric(10,2),
  ADD COLUMN IF NOT EXISTS commission_gst_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS razorpay_transfer_id  varchar(80);
