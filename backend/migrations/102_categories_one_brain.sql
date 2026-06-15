-- ============================================================================
-- Migration 102 — Categories: one brain (Phase 2.5a)
--   (contract: features/merch-engine-p25a-categories-one-brain)
-- ----------------------------------------------------------------------------
-- Foundation step: make follower_categories the SINGLE source of truth for the
-- category-tile → business-type linkage, reconfigured to the 5 LOCKED launch
-- tiles, and merge the legacy fashion split into one `fashion`.
--
-- 1. Merge business types: fashion_walkin + fashion_online → fashion (schema
--    resolution already aliases these; this aligns the stored data).
-- 2. Reset follower_categories to the 5 launch tiles (Fashion, Furniture, Food,
--    Beauty, Car Rentals), each = exactly ONE business type. Hide every other
--    tile (reversible — data kept, not deleted).
-- 3. Reconcile legacy section_config.category_key values (dining/shopping) to the
--    new tile keys (food/fashion) so Home shelves point at real tiles.
--
-- Idempotent (ON CONFLICT DO UPDATE; UPDATEs are re-runnable). Additive/reversible.
-- ============================================================================

BEGIN;

-- 1. Fashion merge (data) ----------------------------------------------------
UPDATE brands SET category = 'fashion'
 WHERE category IN ('fashion_walkin', 'fashion_online');

-- 2. The 5 launch tiles ------------------------------------------------------
INSERT INTO follower_categories (key, label, icon, sort_order, status, member_categories) VALUES
  ('fashion',    'Fashion',     '👗', 1, 'active', ARRAY['fashion']),
  ('furniture',  'Furniture',   '🛋️', 2, 'active', ARRAY['furniture']),
  ('food',       'Food',        '🍽️', 3, 'active', ARRAY['restaurant']),
  ('beauty',     'Beauty',      '✨', 4, 'active', ARRAY['salon']),
  ('car_rental', 'Car Rentals', '🚗', 5, 'active', ARRAY['car_rental'])
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label,
      icon = EXCLUDED.icon,
      sort_order = EXCLUDED.sort_order,
      status = 'active',
      member_categories = EXCLUDED.member_categories,
      updated_at = now();

-- Hide every tile that is NOT one of the 5 launch tiles (reversible).
UPDATE follower_categories SET status = 'hidden', updated_at = now()
 WHERE key NOT IN ('fashion', 'furniture', 'food', 'beauty', 'car_rental');

-- 3. Reconcile legacy section_config category keys to the new tile keys -------
UPDATE section_config SET category_key = 'food'    WHERE category_key = 'dining';
UPDATE section_config SET category_key = 'fashion' WHERE category_key = 'shopping';

COMMIT;
