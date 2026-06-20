-- 112 — Commerce settlement HOLD + influencer earnings LEDGER (Money G-3 + G-5).
--
-- G-3 (hold brand commerce payout until the return window closes, with
-- per-item pro-rated return claw-back) + G-5 (forward-only influencer ledger).
--
-- Forward-only, ADDITIVE, IDEMPOTENT (ADD COLUMN IF NOT EXISTS / CREATE TABLE
-- IF NOT EXISTS). Safe to re-run. NOTE: the migration number 110 requested in
-- the brief was ALREADY TAKEN by 110_follower_verticals_home.sql (and 111 by
-- 111_follower_categories_image.sql, both owned by another worker) — next free
-- slot is 112. Sequence integrity preserved.
--
-- KEY MODEL: an order is single-brand → single category → ONE return window per
-- order (settlement.service.resolveReturnWindowEndsAt via brands.category).
-- Per-item only matters for PARTIAL returns of a multi-item online order.

-- ── G-3: settlement state on the commerce transaction ────────────────────────
-- brand_settlement_status lifecycle:
--   pending  — sale recorded, brand NOT yet paid (default for all NEW sales)
--   settled  — commerce-settlement job ran settleCommerceTransaction (TCS +
--              GST recorded, Route transfer of net fired)
--   reversed — whole order returned before settlement → brand never paid
--   skipped  — (reserved) settlement deliberately not applicable
ALTER TABLE follower_transactions
  ADD COLUMN IF NOT EXISTS brand_settlement_status varchar(16) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS brand_settled_at        timestamptz,
  ADD COLUMN IF NOT EXISTS commission_reversed     numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brand_net_reversed      numeric(12,2) NOT NULL DEFAULT 0;

-- BACKFILL (critical): legacy rows were settled at SALE TIME under the old code
-- (tcs_amount written inline). Mark them 'settled' so the new commerce-settlement
-- job NEVER re-touches / double-pays them. Only rows that were already settled
-- (tcs_amount IS NOT NULL) and still carry the new default 'pending' are migrated.
-- NOTE: follower_transactions has NO updated_at column (verified vs 001 + all
-- later migrations) — use created_at for the settled-at stamp.
UPDATE follower_transactions
   SET brand_settlement_status = 'settled',
       brand_settled_at        = created_at
 WHERE tcs_amount IS NOT NULL
   AND brand_settlement_status = 'pending';

-- ── G-3: per-item claw-back idempotency on the return row ────────────────────
-- reversed_at guards the claw-back so a second mark-refunded never double-claws.
ALTER TABLE follower_returns
  ADD COLUMN IF NOT EXISTS reversed_commission numeric(12,2),
  ADD COLUMN IF NOT EXISTS reversed_at         timestamptz;

-- ── G-5: forward-only influencer earnings ledger ─────────────────────────────
-- House style mirrors brand wallet_transactions (type/amount/direction/
-- balance_after) plus balance_field so a reader knows WHICH bucket moved
-- (pending_balance | wallet_balance). No backfill — forward-only audit trail.
CREATE TABLE IF NOT EXISTS influencer_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES influencers(id),
  type          varchar(28) NOT NULL,   -- sale_commission_pending | commission_confirm | tranche_release | withdrawal | withdrawal_reversal | enquiry_commission | referral_accrual | return_clawback
  amount        numeric(12,2) NOT NULL,
  direction     varchar(6) NOT NULL,    -- credit | debit
  balance_field varchar(16) NOT NULL,   -- pending_balance | wallet_balance
  balance_after numeric(12,2),          -- snapshot of the moved bucket after the move (nullable when not cheaply available)
  source        varchar(24),            -- e.g. follower_txn | escrow | withdrawal | enquiry | referral | return
  source_ref_id uuid,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_influencer_ledger_inf_created
  ON influencer_ledger (influencer_id, created_at DESC);
