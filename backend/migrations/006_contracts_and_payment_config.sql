-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — Contracts table + Payment Config table
-- A1: Create contracts table (was defined in 001 but never applied)
-- A2: Create payment_config table — makes all fee/tranche values runtime-editable
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A1: Contracts ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM (
    'pending_influencer', 'pending_brand', 'active', 'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS contracts (
  id                     UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_influencer_id UUID            NOT NULL REFERENCES campaign_influencers(id) ON DELETE CASCADE UNIQUE,
  influencer_fee         NUMERIC(10,2),
  revision_limit         INT             DEFAULT 2,
  posting_date           DATE,
  content_requirements   TEXT,
  brand_name             VARCHAR(150),
  influencer_name        VARCHAR(100),
  campaign_name          VARCHAR(150),
  influencer_signed_at   TIMESTAMPTZ,
  influencer_signed_name VARCHAR(100),
  brand_signed_at        TIMESTAMPTZ,
  brand_signed_by        UUID            REFERENCES users(id),
  pdf_url                TEXT,
  status                 contract_status DEFAULT 'pending_influencer',
  created_at             TIMESTAMPTZ     DEFAULT now(),
  updated_at             TIMESTAMPTZ     DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_ci ON contracts (campaign_influencer_id);

-- Auto-update updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── A2: Payment Config ────────────────────────────────────────────────────────
-- Single-row table. Row ID is always 1 (enforced by constraint).
-- All monetary logic reads from this table at runtime, not from .env.

CREATE TABLE IF NOT EXISTS payment_config (
  id                  INT  PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  platform_fee_pct    NUMERIC(5,2)  NOT NULL DEFAULT 8.00,
  tranche_1_pct       NUMERIC(5,2)  NOT NULL DEFAULT 25.00,
  tranche_2_pct       NUMERIC(5,2)  NOT NULL DEFAULT 25.00,
  tranche_3_pct       NUMERIC(5,2)  NOT NULL DEFAULT 50.00,
  tds_pct             NUMERIC(5,2)  NOT NULL DEFAULT 10.00,
  offer_expiry_hours  INT           NOT NULL DEFAULT 48,
  return_window_days  INT           NOT NULL DEFAULT 30,
  min_withdrawal_inr  NUMERIC(8,2)  NOT NULL DEFAULT 100.00,
  updated_at          TIMESTAMPTZ   DEFAULT now(),
  updated_by          UUID          REFERENCES users(id)
);

-- Seed with defaults (matches current .env values exactly)
INSERT INTO payment_config (id, platform_fee_pct, tranche_1_pct, tranche_2_pct, tranche_3_pct,
                             tds_pct, offer_expiry_hours, return_window_days, min_withdrawal_inr)
VALUES (1, 8.00, 25.00, 25.00, 50.00, 10.00, 48, 30, 100.00)
ON CONFLICT (id) DO NOTHING;
