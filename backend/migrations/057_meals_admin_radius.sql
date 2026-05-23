-- 057_meals_admin_radius.sql
-- INFLX Meals — admin-set platform radius + address-first routing.
-- Contract: features/meals-admin-radius/.
--
-- Replaces the per-restaurant delivery-radius primary control with a
-- single admin-set platform radius (+ tolerance), applied between the
-- customer's drop location and each restaurant's fixed brand.lat/lng.
-- The per-restaurant `restaurant_meal_config.delivery_radius_km` stays
-- in place but the engine ignores it for routing (kept for a future
-- per-restaurant override capped by admin).
--
-- Also adds optional lat/lng to follower_addresses so a saved delivery
-- address can route directly without re-asking for GPS.

-- ── Platform-wide Meals settings (single row) ────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_meals_settings (
  id                       int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  radius_km                numeric(5,2) NOT NULL DEFAULT 5.00,
  radius_tolerance_m       int          NOT NULL DEFAULT 500,
  min_order_lead_minutes   int          NOT NULL DEFAULT 120,
  updated_at               timestamptz  DEFAULT now()
);

-- Seed exactly one row (5 km, ±500 m, 2 h lead). Idempotent.
INSERT INTO platform_meals_settings (id, radius_km, radius_tolerance_m, min_order_lead_minutes)
VALUES (1, 5.00, 500, 120)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE TRIGGER platform_meals_settings_updated_at
    BEFORE UPDATE ON platform_meals_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── follower_addresses — optional geocoded coordinates ──────────────────────
ALTER TABLE follower_addresses ADD COLUMN IF NOT EXISTS lat numeric(10,6);
ALTER TABLE follower_addresses ADD COLUMN IF NOT EXISTS lng numeric(10,6);
