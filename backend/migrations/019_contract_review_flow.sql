-- 019_contract_review_flow.sql
-- Adds the brand-reviews-first contract flow:
--   * New 'draft' status — auto-create writes here so brand can review/edit
--     before influencer can sign.
--   * custom_clauses JSONB to store brand-selected toggles + free-form notes
--   * bonus_amount NUMERIC for optional brand bonus on top of agreed fee
--
-- Backfills existing contracts to keep them functional under the new flow.

BEGIN;

-- ── 1. Add 'draft' to the contract_status enum ────────────────────────────
DO $$ BEGIN
  ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'pending_influencer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. New columns on contracts ───────────────────────────────────────────
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS custom_clauses JSONB,
  ADD COLUMN IF NOT EXISTS bonus_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by    UUID REFERENCES users(id);

-- ── 3. Existing contracts in 'pending_influencer' or later are unaffected.
-- We do NOT retroactively set them back to 'draft' — they already moved on.

COMMIT;
