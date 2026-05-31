-- ============================================================================
-- Migration 079 — Referral Settings (Contract 2: referral-admin-controls)
-- ----------------------------------------------------------------------------
-- A single-row global config table for the referral system. Holds the
-- default referral % that new referral_edges inherit when an admin (or, later,
-- a signup-code flow) creates an edge without an explicit pct. The 12-month
-- earning window stays a code constant (referral.service REFERRAL_WINDOW_MONTHS)
-- and is intentionally NOT admin-editable.
--
-- Additive + idempotent + forward-only. Singleton enforced by a CHECK (id = 1).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS referral_settings (
  id                  int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_pct         numeric(5,2) NOT NULL DEFAULT 25.00
                        CHECK (default_pct >= 0 AND default_pct <= 100),
  updated_by_admin_id uuid NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row (no-op if it already exists).
INSERT INTO referral_settings (id, default_pct)
VALUES (1, 25.00)
ON CONFLICT (id) DO NOTHING;

COMMIT;
