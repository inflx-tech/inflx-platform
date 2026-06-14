-- ============================================================================
-- Migration 100 — Follower category tiles → DB
--   (contract: features/merch-engine-p1b-category-admin)
-- ----------------------------------------------------------------------------
-- The top-level follower "browse by category" tiles, previously hardcoded as
-- SUPER_CATEGORIES in listing.service.js. Admin-managed: label / icon / order /
-- status + member business-categories. SEEDED with the 7 current tiles so the
-- follower Find screen is byte-identical on deploy.
--
-- listing.service.getSuperCategories() reads this table and FALLS BACK to the
-- hardcoded constant if it is empty/unreachable — followers never see an empty
-- category list. Additive · idempotent (ON CONFLICT (key) DO NOTHING).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS follower_categories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key               text UNIQUE NOT NULL,
  label             text NOT NULL,
  icon              text,
  sort_order        integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  member_categories text[] NOT NULL DEFAULT '{}'::text[],
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follower_categories_active
  ON follower_categories (status, sort_order);

-- Seed = the 7 current hardcoded tiles (listing.service.js SUPER_CATEGORIES):
-- exact keys / labels / icons / member lists / order → follower output unchanged.
INSERT INTO follower_categories (key, label, icon, sort_order, member_categories) VALUES
  ('eat',     'Eat',      '🍽️', 1, ARRAY['restaurant','bakery','packaged_food','grocery']),
  ('shop',    'Shop',     '🛍️', 2, ARRAY['fashion_walkin','fashion_online','electronics','jewellery','footwear','furniture','optical','pet_shop','flowers_gifting','hardware']),
  ('groom',   'Groom',    '✨',  3, ARRAY['salon','home_beauty','pet_grooming']),
  ('fitness', 'Stay Fit', '💪',  4, ARRAY['gym_fitness','clinic_doctor','dental_clinic','diagnostic_lab','coaching_center']),
  ('travel',  'Travel',   '✈️', 5, ARRAY['travel_packages','car_rental','bike_rental','hotel_homestay']),
  ('home',    'Home',     '🏠',  6, ARRAY['home_services','interior_design','pest_control','laundry','coworking_space']),
  ('events',  'Events',   '🎉',  7, ARRAY['function_hall','wedding_planner','florist','photography','legal_ca'])
ON CONFLICT (key) DO NOTHING;

COMMIT;
