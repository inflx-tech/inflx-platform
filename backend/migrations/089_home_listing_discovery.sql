-- 089 — Home screen → listing-driven shelves so Home populates without offers.
--
-- Founder dogfood 2026-06-08: even after 088 made the Category screen
-- listing-driven, the follower app still showed nothing — because the mobile
-- Home (HomeScreenV2) only renders the section engine when hasEngineContent() is
-- true (a DATA shelf has items). Home's data shelves were all offer-gated and
-- empty, so Home fell back to the old screen and HID the browse-by-category
-- tiles → no way to reach the working Category screen.
--
-- Re-point Home's Eat business + dish shelves at the listing-driven rules (added
-- in 088 / sectionRules.service.js). Offers stay as the overlay shelves.
-- Idempotent (UPDATE by position). No schema change.

-- "Top Eats in {city}" (brands) → approved restaurants in Eat (no offer needed).
UPDATE section_config
   SET rule = 'businesses_in_category', category_key = 'dining'
 WHERE screen = 'home' AND position = 5;

-- "Trending Dishes in Eat" (products) → active dishes; ENABLE.
UPDATE section_config
   SET rule = 'products_in_category', category_key = 'dining', enabled = true
 WHERE screen = 'home' AND position = 6;

-- "Top Fashion in {city}" (brands) → listing-first too (empty until fashion lists).
UPDATE section_config
   SET rule = 'businesses_in_category', category_key = 'shopping'
 WHERE screen = 'home' AND position = 8;
