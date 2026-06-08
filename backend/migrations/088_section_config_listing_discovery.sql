-- 088 — Category screen → LISTING-DRIVEN discovery (offer-independent).
--
-- Founder dogfood 2026-06-07: a listed, approved restaurant with a full menu was
-- invisible in the follower app because every Category-screen shelf ranked the
-- live-offer chain (campaign_offers). Discovery must be driven by LISTINGS
-- (approved brands + their products + creators who picked them); offers are an
-- overlay (the "Best deals" shelf), not a gate.
--
-- Re-points the seeded Category shelves (083) at the new listing-driven rules
-- added in sectionRules.service.js. Idempotent (UPDATE by shelf_key). Additive:
-- the "Best {category} Deals" shelf stays offer-based.

-- Top creators: from offer-gated → creators who PICKED products in the category.
UPDATE section_config
   SET rule = 'creators_in_category_listing'
 WHERE screen = 'category' AND shelf_key = 'top_creators';

-- Popular / All businesses: from offer-engagement → approved brands in category.
UPDATE section_config
   SET rule = 'businesses_in_category', item_type = 'brands'
 WHERE screen = 'category' AND shelf_key IN ('popular_businesses', 'all_businesses');

-- Trending items: from disabled top_by_sales → active products in category; ENABLE.
UPDATE section_config
   SET rule = 'products_in_category', item_type = 'products', enabled = true
 WHERE screen = 'category' AND shelf_key = 'trending_items';
