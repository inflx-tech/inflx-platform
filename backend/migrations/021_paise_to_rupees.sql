-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 021 — Normalize all internal monetary values to RUPEES.
--
-- Background
-- ----------
-- Historically the platform stored some columns in PAISE (brand wallet,
-- follower-transaction amounts, withdrawals, etc.) and others in RUPEES
-- (campaign budgets, contract fees, escrow entries, products). The split
-- was a constant source of off-by-100 display bugs and mixed-unit writes
-- to shared columns — in particular influencers.wallet_balance, which
-- received RUPEES from tranche releases (escrow.service) but PAISE from
-- follower-transaction commission credits (transaction.service).
--
-- From this migration onward: ALL monetary values stored in the DB are in
-- RUPEES (numeric(x,2)). The only place paise exists is at the Razorpay
-- API boundary — createTopup request, Razorpay orders/payouts API calls,
-- webhook payloads — where the backend converts rupees ↔ paise on the fly.
--
-- Conversion strategy
-- -------------------
-- For columns that were consistently PAISE, divide by 100.
--
-- For influencers.wallet_balance / pending_balance / total_earned /
-- total_withdrawn: these had MIXED units so we cannot safely /100 them.
-- Instead we RECOMPUTE from the source-of-truth tables (escrow_entries
-- for contract earnings, follower_transactions for commissions,
-- influencer_withdrawals for deductions) now that those have been
-- normalized to rupees in this same transaction.
--
-- Idempotency
-- -----------
-- This migration is NOT idempotent. Running it twice will divide values
-- by 100 a second time. It is intended to be run exactly once via a
-- one-shot script against production and then removed from the migration
-- runner. The matching runner script is scripts/run-021.js.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. Brand wallet ────────────────────────────────────────────────────────
UPDATE brands
   SET wallet_balance = wallet_balance / 100.0
 WHERE wallet_balance IS NOT NULL;

-- ─── 2. Wallet transactions (topup / escrow_lock / escrow_release / refund) ─
UPDATE wallet_transactions
   SET amount        = amount        / 100.0,
       balance_after = balance_after / 100.0
 WHERE amount IS NOT NULL OR balance_after IS NOT NULL;

-- ─── 3. Follower transactions (all money columns) ──────────────────────────
UPDATE follower_transactions
   SET gross_amount          = gross_amount          / 100.0,
       discount_amount       = discount_amount       / 100.0,
       net_amount            = net_amount            / 100.0,
       influencer_commission = influencer_commission / 100.0,
       platform_fee          = platform_fee          / 100.0,
       brand_net             = brand_net             / 100.0;

-- ─── 4. Influencer withdrawals ──────────────────────────────────────────────
UPDATE influencer_withdrawals
   SET amount_requested = amount_requested / 100.0,
       tds_deducted     = tds_deducted     / 100.0,
       net_paid         = net_paid         / 100.0;

-- ─── 5. Follower bookings (advance + balance_due) ──────────────────────────
UPDATE follower_bookings
   SET advance_paid         = advance_paid         / 100.0,
       balance_due_at_venue = balance_due_at_venue / 100.0;

-- ─── 6. Influencer balances: RECOMPUTE from source of truth ────────────────
-- wallet_balance:
--   + released tranche net_to_influencer amounts (escrow_entries, already rupees)
--   + confirmed follower commissions (older than 30-day pending window, now rupees)
--   − withdrawals in completed / processing / initiated state (now rupees)
-- pending_balance:
--   = follower commissions within the 30-day pending window
-- total_earned:
--   + released tranche amounts
--   + all follower commissions (pending + confirmed)
UPDATE influencers i SET
  total_earned = COALESCE((
    SELECT SUM(net_to_influencer)
    FROM   escrow_entries ee
    JOIN   campaign_influencers ci ON ci.id = ee.campaign_influencer_id
    WHERE  ci.influencer_id = i.id AND ee.status = 'released'
  ), 0) + COALESCE((
    SELECT SUM(influencer_commission)
    FROM   follower_transactions ft
    JOIN   campaign_influencers ci ON ci.id = ft.campaign_influencer_id
    WHERE  ci.influencer_id = i.id AND ft.status = 'completed'
  ), 0),

  wallet_balance = COALESCE((
    SELECT SUM(net_to_influencer)
    FROM   escrow_entries ee
    JOIN   campaign_influencers ci ON ci.id = ee.campaign_influencer_id
    WHERE  ci.influencer_id = i.id AND ee.status = 'released'
  ), 0) + COALESCE((
    SELECT SUM(influencer_commission)
    FROM   follower_transactions ft
    JOIN   campaign_influencers ci ON ci.id = ft.campaign_influencer_id
    WHERE  ci.influencer_id = i.id
      AND  ft.status = 'completed'
      AND  ft.created_at < now() - interval '30 days'
  ), 0) - COALESCE((
    SELECT SUM(amount_requested)
    FROM   influencer_withdrawals iw
    WHERE  iw.influencer_id = i.id
      AND  iw.status IN ('completed', 'processing', 'initiated')
  ), 0),

  pending_balance = COALESCE((
    SELECT SUM(influencer_commission)
    FROM   follower_transactions ft
    JOIN   campaign_influencers ci ON ci.id = ft.campaign_influencer_id
    WHERE  ci.influencer_id = i.id
      AND  ft.status = 'completed'
      AND  ft.created_at >= now() - interval '30 days'
  ), 0);

COMMIT;
