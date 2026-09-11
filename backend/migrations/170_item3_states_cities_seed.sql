-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 170 — Item 3: the remaining states and union territories, plus three cities
-- Contract: features/item3-discovery-profiles-groups · rules v1.11 §8A (state → city list)
-- Source: backend/seeds/states_cities_additions.csv (founder, 2026-09-11)
--
-- WHY FIRST. Item 3 backfills every typed brand and creator city onto the canonical
-- list (migrations 171–172). The founder chose to seed ALL 36 states and union
-- territories now (states are never auto-added; only cities are) and added the three
-- cities that today's accounts use but the item-2 seed lacked: Delhi, Ongole, Karnal.
-- So this runs before the backfills.
--
-- Additive + idempotent. state_sort continues from 18. All rows source = 'seed'.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO ref_states (name, sort) VALUES
  ('Andhra Pradesh', 1),
  ('Haryana', 12),
  ('Delhi', 7),
  ('Assam', 18),
  ('Bihar', 19),
  ('Chhattisgarh', 20),
  ('Jharkhand', 21),
  ('Uttarakhand', 22),
  ('Himachal Pradesh', 23),
  ('Jammu and Kashmir', 24),
  ('Puducherry', 25),
  ('Tripura', 26),
  ('Meghalaya', 27),
  ('Manipur', 28),
  ('Nagaland', 29),
  ('Mizoram', 30),
  ('Arunachal Pradesh', 31),
  ('Sikkim', 32),
  ('Ladakh', 33),
  ('Andaman and Nicobar Islands', 34),
  ('Dadra and Nagar Haveli and Daman and Diu', 35),
  ('Lakshadweep', 36)
ON CONFLICT (name) DO NOTHING;

INSERT INTO ref_cities (state_id, name, name_norm, sort, source)
SELECT s.id, v.city, lower(trim(v.city)), v.sort, 'seed'
FROM (VALUES
  ('Andhra Pradesh', 'Ongole', 11),
  ('Haryana', 'Karnal', 3),
  ('Delhi', 'Delhi', 2),
  ('Assam', 'Guwahati', 1),
  ('Assam', 'Silchar', 2),
  ('Bihar', 'Patna', 1),
  ('Bihar', 'Gaya', 2),
  ('Chhattisgarh', 'Raipur', 1),
  ('Chhattisgarh', 'Bilaspur', 2),
  ('Jharkhand', 'Ranchi', 1),
  ('Jharkhand', 'Jamshedpur', 2),
  ('Uttarakhand', 'Dehradun', 1),
  ('Uttarakhand', 'Haridwar', 2),
  ('Himachal Pradesh', 'Shimla', 1),
  ('Jammu and Kashmir', 'Srinagar', 1),
  ('Jammu and Kashmir', 'Jammu', 2),
  ('Puducherry', 'Puducherry', 1),
  ('Tripura', 'Agartala', 1),
  ('Meghalaya', 'Shillong', 1),
  ('Manipur', 'Imphal', 1),
  ('Nagaland', 'Kohima', 1),
  ('Mizoram', 'Aizawl', 1),
  ('Arunachal Pradesh', 'Itanagar', 1),
  ('Sikkim', 'Gangtok', 1),
  ('Ladakh', 'Leh', 1),
  ('Andaman and Nicobar Islands', 'Port Blair', 1),
  ('Dadra and Nagar Haveli and Daman and Diu', 'Daman', 1),
  ('Dadra and Nagar Haveli and Daman and Diu', 'Silvassa', 2),
  ('Lakshadweep', 'Kavaratti', 1)
) AS v(state, city, sort)
JOIN ref_states s ON s.name = v.state
ON CONFLICT (state_id, name) DO NOTHING;

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM ref_states;   -- 36
--   SELECT count(*) FROM ref_cities;   -- 92
