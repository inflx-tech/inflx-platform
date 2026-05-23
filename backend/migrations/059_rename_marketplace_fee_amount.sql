-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 059 — Rename follower_transactions.platform_fee
--                          → marketplace_fee_amount
--
-- Phase A2 of the INFLX 3-Layer Revenue Model. With 3 fee layers
-- (L1 subscription, L2 escrow, L3 marketplace) the legacy column name
-- "platform_fee" became ambiguous; this column specifically holds the
-- L3 per-follower-transaction fee. Rename for clarity.
--
-- All backend readers updated in the same commit (admin/brand/transaction
-- controllers). API JSON wire format preserved via SELECT-AS aliases
-- (response key stays `platform_fee` until a future contract renames it).
--
-- Idempotent: if column has already been renamed, the DO $$ guard skips
-- the ALTER. ALTER TABLE RENAME COLUMN is metadata-only — no row rewrite,
-- no lock other than a brief ACCESS EXCLUSIVE for the catalog update.
--
-- Contract: features/billing-column-rename/.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'follower_transactions'
       AND column_name = 'platform_fee'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'follower_transactions'
       AND column_name = 'marketplace_fee_amount'
  ) THEN
    ALTER TABLE follower_transactions
      RENAME COLUMN platform_fee TO marketplace_fee_amount;
  END IF;
END $$;

COMMENT ON COLUMN follower_transactions.marketplace_fee_amount IS
  'L3 marketplace fee deducted from gross at follower-transaction time. Computed via pricing.service.computeL3OnFollowerTxn (Phase A3+A5); legacy rows pre-A5 were computed via brands.platform_fee_pct.';

COMMIT;
