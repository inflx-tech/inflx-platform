-- Migration 126 — World Rules (Phase 3, features/phase3-world-rules/).
--
-- Per-world behaviour settings for the section engine. Today location is a
-- hardcoded soft-boost everywhere; this table lets the admin choose, per
-- world, whether location is a BOUNDARY (hard radius / city gate — food's
-- deliverability case), a RANKING hint (today's behaviour), or OFF, plus
-- what to do when an area is empty and a default freshness window.
--
-- ABSENT ROW = today's behaviour (rank_only). The table ships empty — this
-- migration is deploy-inert until the admin saves a row (World Settings
-- screen). Additive + idempotent; touches no rows.

CREATE TABLE IF NOT EXISTS world_rule_settings (
  world_key           text PRIMARY KEY,   -- follower_categories key (food/fashion/furniture/beauty/car_rental)
  location_mode       text NOT NULL DEFAULT 'rank_only'
                      CHECK (location_mode IN ('boundary','rank_only','off')),
  radius_km           numeric(6,1) NULL,  -- used when location_mode='boundary'
  empty_fallback      text NOT NULL DEFAULT 'show_nearest'
                      CHECK (empty_fallback IN ('widen','show_nearest','show_empty')),
  window_days_default int NULL CHECK (window_days_default IS NULL OR (window_days_default >= 1 AND window_days_default <= 90)),
  item_limit_default  int NULL CHECK (item_limit_default IS NULL OR (item_limit_default >= 0 AND item_limit_default <= 50)),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE world_rule_settings IS
  'Per-world section-engine behaviour (mig 126): location boundary/rank/off + radius + empty-area fallback + defaults. Absent row = rank_only (legacy behaviour).';
COMMENT ON COLUMN world_rule_settings.location_mode IS
  'boundary = hard radius (coords) or city gate (no coords); rank_only = distance/city sort only (legacy); off = location ignored';
COMMENT ON COLUMN world_rule_settings.empty_fallback IS
  'boundary shelf resolves empty: widen = retry at 2x radius once; show_nearest = retry unbounded; show_empty = honest empty';
