-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 037 — Layer 2: Campaign Protection Fee (tiered escrow)
--
-- Replaces the single-rate platform_fee_pct on escrow with a tiered lookup:
--   • Below ₹5L  → 3%
--   • ₹5L–₹25L  → 2%
--   • Above ₹25L → 1%
--
-- The fee rate is locked PER CAMPAIGN at publish time, based on the sum of
-- set_budget across engagement+hybrid sets. Pure conversion sets contribute
-- nothing to the L2 base. Once locked, the rate stays for the life of the
-- campaign even if budget changes — see "Lock-at-publish" decision (Q3).
--
-- Backward compat: existing campaigns get NULL escrow_fee_pct_locked. The
-- escrow service falls back to the legacy payment_config.platform_fee_pct
-- path when locked is NULL, so in-flight campaigns are unaffected.
--
-- Also renames escrow_entries.platform_fee_amount → escrow_fee_amount so the
-- column name reflects what it actually is (L2 fee, not the umbrella platform
-- fee — L3 marketplace fee will live on follower_transactions in Phase B2).
--
-- Idempotent. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. New table: escrow_fee_tiers (admin-editable, seeded with 3 rows) ──────

CREATE TABLE IF NOT EXISTS escrow_fee_tiers (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key        VARCHAR(40)   UNIQUE NOT NULL,
  min_amount_inr  NUMERIC(12,2) NOT NULL,
  max_amount_inr  NUMERIC(12,2),                       -- NULL = unbounded
  fee_pct         NUMERIC(5,2)  NOT NULL CHECK (fee_pct >= 0 AND fee_pct <= 50),
  description     TEXT,
  sort_order      INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_by      UUID          REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_escrow_fee_tiers_min ON escrow_fee_tiers (min_amount_inr);

DO $$ BEGIN
  CREATE TRIGGER escrow_fee_tiers_updated_at
    BEFORE UPDATE ON escrow_fee_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO escrow_fee_tiers (tier_key, min_amount_inr, max_amount_inr, fee_pct, description, sort_order)
VALUES
  ('small', 0,       500000,  3.00, 'Below ₹5 lakh — small brands, full hand-holding', 1),
  ('mid',   500001,  2500000, 2.00, '₹5–25 lakh — mid-volume discount',                 2),
  ('large', 2500001, NULL,    1.00, 'Above ₹25 lakh — big brands, low % high rupee value', 3)
ON CONFLICT (tier_key) DO NOTHING;

-- ── 2. Lock columns on campaigns (set at publish, immutable thereafter) ──────

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS escrow_fee_pct_locked NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS escrow_fee_base_inr   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS escrow_fee_locked_at  TIMESTAMPTZ;

COMMENT ON COLUMN campaigns.escrow_fee_pct_locked IS
  'L2 escrow fee rate locked at publish based on engagement+hybrid set budgets. NULL for legacy campaigns predating M037 — escrow service falls back to payment_config.platform_fee_pct in that case.';
COMMENT ON COLUMN campaigns.escrow_fee_base_inr IS
  'Sum of set_budget across engagement+hybrid sets at publish (audit only — does not change with renegotiation).';

-- ── 3. Per-brand override (independent of legacy brands.platform_fee_pct) ───

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS escrow_fee_override_pct NUMERIC(5,2)
    CHECK (escrow_fee_override_pct IS NULL OR (escrow_fee_override_pct >= 0 AND escrow_fee_override_pct <= 50));

COMMENT ON COLUMN brands.escrow_fee_override_pct IS
  'Per-brand override for L2 escrow fee. NULL = use escrow_fee_tiers lookup. Independent of platform_fee_pct (which remains for L3 legacy compat until Phase B2).';

-- ── 4. Rename escrow_entries.platform_fee_amount → escrow_fee_amount ────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escrow_entries' AND column_name = 'platform_fee_amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escrow_entries' AND column_name = 'escrow_fee_amount'
  ) THEN
    ALTER TABLE escrow_entries RENAME COLUMN platform_fee_amount TO escrow_fee_amount;
  END IF;
END $$;

COMMENT ON COLUMN escrow_entries.escrow_fee_amount IS
  'L2 fee deducted from this tranche, computed as tranche_amount * (campaigns.escrow_fee_pct_locked / 100). For legacy entries created before M037, this is the old payment_config-based amount.';

COMMIT;
