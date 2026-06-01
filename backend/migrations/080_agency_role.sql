-- ============================================================================
-- Migration 080 — Agency role + wallet + withdrawals (Contract 3a)
-- ----------------------------------------------------------------------------
-- Makes the Strategic Partner AGENCY a first-class role so the referral engine
-- (Contract 1) can settle agency referral commission into a real wallet instead
-- of parking it as payout_status='pending'.
--
-- Split on `-- @@SPLIT@@` (per run-075 precedent): the ALTER TYPE ... ADD VALUE
-- runs STANDALONE first (a new enum value must be committed before anything can
-- use it / it is non-transactional on some PG versions); then the table + config
-- DDL runs. Additive + idempotent + forward-only.
-- ============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'agency';

-- @@SPLIT@@

-- ── agencies — the partner-agency profile + wallet ──────────────────────────
CREATE TABLE IF NOT EXISTS agencies (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  agency_name           varchar(150) NOT NULL,
  contact_person        varchar(120),
  contact_email         varchar(160),
  city                  varchar(60),
  state                 varchar(60),
  -- payout details (encrypted at the app layer, like influencers)
  upi_id                text,                -- AES-256-GCM encrypted (like influencers)
  bank_account_no       text,                -- AES-256-GCM encrypted
  bank_ifsc             varchar(12),
  account_holder_name   varchar(120),
  razorpay_contact_id   varchar(80),         -- cached RazorpayX contact for payouts
  -- wallet (mirrors influencers): referral earnings land here
  wallet_balance        numeric(12,2) NOT NULL DEFAULT 0,
  pending_balance       numeric(12,2) NOT NULL DEFAULT 0,
  referral_earned_total numeric(12,2) NOT NULL DEFAULT 0,
  -- TDS controls (194H @ payment_config.agency_tds_pct by default)
  tds_exempt            boolean NOT NULL DEFAULT false,
  tds_override_pct      numeric(5,2) NULL,
  -- approval lifecycle (mirrors brands/influencers; status lives on users)
  rejection_reason      text,
  approved_at           timestamptz,
  approved_by           uuid REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS agencies_updated_at ON agencies;
CREATE TRIGGER agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── agency_withdrawals — mirrors influencer_withdrawals (reuses enums) ──────
CREATE TABLE IF NOT EXISTS agency_withdrawals (
  id                   uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id            uuid              NOT NULL REFERENCES agencies(id),
  amount_requested     numeric(10,2)     NOT NULL,
  tds_deducted         numeric(8,2),
  net_paid             numeric(10,2),
  method               withdrawal_method NOT NULL,
  upi_id               text,
  bank_account_no      text,
  bank_ifsc            varchar(12),
  razorpay_payout_id   varchar(80),
  status               withdrawal_status DEFAULT 'initiated',
  created_at           timestamptz       DEFAULT now(),
  completed_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_agency_withdrawals_agency
  ON agency_withdrawals (agency_id, status);

-- ── payment_config.agency_tds_pct — 194H brokerage default 5% ───────────────
ALTER TABLE payment_config
  ADD COLUMN IF NOT EXISTS agency_tds_pct numeric(5,2) NOT NULL DEFAULT 5.00;
