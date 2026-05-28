-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 073 — Wave 1 commit 1: per-actor override columns
--
-- Per-category return window (replaces the global default for commerce
-- commission release timing).
-- Per-influencer TDS controls (exempt + override).
-- Per-brand commerce-commission override (parallel to existing
-- escrow_fee_override_pct on the engagement side).
--
-- All columns are additive + idempotent.
--
-- Contract: features/wave1-tax-config-foundation/.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS return_window_days int NOT NULL DEFAULT 30;

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS tds_override_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS tds_exempt       boolean NOT NULL DEFAULT false;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS commerce_commission_override_pct numeric(5,2);

COMMIT;
