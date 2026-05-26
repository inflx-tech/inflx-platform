-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 069 — Phase A14: per-brand feature overrides.
--
-- Adds a third resolution layer on top of tier_features:
--   catalog (features) → tier_features (per-tier default) →
--   brand_feature_overrides (per-brand override)
--
-- Semantics: presence of a row = entitlement comes from the override
-- (full replacement of included/quota_value/config). Absence = tier
-- default. To revert a brand to tier defaults for a feature, DELETE the
-- override row.
--
-- entitlements.service.getEntitlements LEFT JOINs this table (defensively
-- via try/catch on pg error 42P01 in case the migration hasn't applied
-- yet — see backend/src/services/entitlements.service.js).
--
-- Additive + idempotent (CREATE … IF NOT EXISTS, ALTER … ADD COLUMN IF
-- NOT EXISTS).
--
-- Contract: features/billing-brand-feature-overrides/.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS brand_feature_overrides (
  brand_id      uuid           NOT NULL REFERENCES brands(id)   ON DELETE CASCADE,
  feature_id    uuid           NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  included      boolean        NOT NULL,
  quota_value   numeric(10,2),                                                    -- nullable; -1 = unlimited
  config        jsonb          NOT NULL DEFAULT '{}'::jsonb,
  notes         text,
  created_at    timestamptz    NOT NULL DEFAULT now(),
  updated_at    timestamptz    NOT NULL DEFAULT now(),
  updated_by    uuid           REFERENCES users(id),
  PRIMARY KEY (brand_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_overrides_brand ON brand_feature_overrides (brand_id);

DO $$ BEGIN
  CREATE TRIGGER brand_feature_overrides_updated_at
    BEFORE UPDATE ON brand_feature_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
