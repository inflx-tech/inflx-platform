-- ============================================================================
-- Migration 083 — Section Engine foundation (Creator Vibe, Phase A)
-- ----------------------------------------------------------------------------
-- The follower discovery screens (Home / Category / Offers / Creator Store /
-- Creator's Category) become admin-controlled lists of "shelves" (sections).
-- One row per shelf in section_config. A ranking RULE fills each shelf
-- automatically; admin reorders / toggles / sets count / picks category+type.
--
-- This migration is the SPINE: the table + indexes + the LOCKED catalog seeded
-- as GLOBAL defaults (design/wave4-creator-vibe/SECTION-CATALOG.md, 2026-06-01).
-- City/vertical OVERRIDE rows are authored by admin in Phase B.
--
-- Additive · idempotent · forward-only (per migration convention). DORMANT on
-- deploy: no mobile screen renders from this table until Phase C wires the
-- <SectionRenderer> behind a feature flag — the existing hardcoded feeds keep
-- serving until each screen is flipped. Contract: features/follower-section-engine/.
--
-- Product-rail note (founder-delegated 2026-06-02): rails whose rule is
-- top_by_sales (product-level) are seeded enabled=false — follower_transactions
-- carries offer_id, NOT product_id, so honest product ranking is a fast-follow.
-- No fabricated data ships.
-- ============================================================================

BEGIN;

-- ── section_config — one row per shelf ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS section_config (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen       text NOT NULL
               CHECK (screen IN ('home','category','offers',
                                 'creator_store','creator_category')),
  scope_type   text NOT NULL DEFAULT 'global'
               CHECK (scope_type IN ('global','city','vertical')),
  scope_value  text,                 -- NULL for global; city name; or vertical key
  shelf_key    text NOT NULL,        -- logical shelf id, e.g. 'stories','whats_hot','top_in'
  title        text NOT NULL,        -- display template, may contain {city}/{category}/{creator}
  shelf_type   text NOT NULL
               CHECK (shelf_type IN ('creators','nav_tiles','offers','products',
                                     'brands','mixed','controls')),
  rule         text NOT NULL,        -- rule-library key, or 'static' for nav/controls
  item_type    text
               CHECK (item_type IS NULL OR item_type IN ('brands','products','offers')),
  category_key text,                 -- vertical key for "Top in {category}" rails
  item_limit   int  NOT NULL DEFAULT 8,
  position     int  NOT NULL,        -- order within (screen, scope_type, scope_value)
  enabled      boolean NOT NULL DEFAULT true,
  pinned_ref   uuid,                 -- e.g. Offers hero PIN (a campaign_offers.id)
  config_json  jsonb,               -- chips list / filter list / sub-sort / extensibility
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed idempotency + "one shelf instance per scope" identity. COALESCE so the
-- nullable discriminators participate in uniqueness (repeatable "Top in" rails
-- differ by category_key + item_type).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_section_instance
  ON section_config (screen, scope_type, COALESCE(scope_value,''),
                     shelf_key, COALESCE(category_key,''), COALESCE(item_type,''));

-- Resolver hot path: enabled shelves for a (screen, scope) in render order.
CREATE INDEX IF NOT EXISTS idx_section_screen_scope
  ON section_config (screen, scope_type, scope_value, position)
  WHERE enabled = true;

-- ── SEED: locked catalog defaults (GLOBAL scope) ────────────────────────────
-- ON CONFLICT DO NOTHING keeps this re-runnable and non-destructive of any
-- admin edits already made in prod.

-- 🏠 HOME ---------------------------------------------------------------------
INSERT INTO section_config
  (screen, scope_type, shelf_key, title, shelf_type, rule, item_type, category_key, item_limit, position, enabled, config_json)
VALUES
  ('home','global','stories','Stories','creators','stories',NULL,NULL,12,1,true,
     '{"sub":"creators you follow + active near you"}'),
  ('home','global','browse_category','Browse by Category','nav_tiles','nav_verticals',NULL,NULL,7,2,true,
     '{"verticals":[{"key":"dining","label":"Eat","icon":"🍽️"},{"key":"shopping","label":"Shop","icon":"🛍️"},{"key":"groom","label":"Groom","icon":"✨"},{"key":"stay_fit","label":"Stay Fit","icon":"💪"},{"key":"travel","label":"Travel","icon":"✈️"},{"key":"home","label":"Home","icon":"🏠"},{"key":"events","label":"Events","icon":"🎉"}]}'),
  ('home','global','whats_hot','What''s Hot in {city}','offers','top_by_engagement',NULL,NULL,5,3,true,
     '{"window_days":7,"sub":"top offers by engagement · 7 days"}'),
  ('home','global','top_picks','Top Picks This Week','mixed','top_picks',NULL,NULL,8,4,true,
     '{"window_days":7,"sub":"most-bought & saved · your city"}'),
  ('home','global','top_in','Top Eats in {city}','brands','top_by_engagement','brands','dining',8,5,true,
     '{"sub":"top food brands by engagement"}'),
  ('home','global','top_in','Trending Dishes in Eat','products','top_by_sales','products','dining',8,6,false,
     '{"sub":"top-selling items in food","disabled_reason":"product attribution deferred (follower_transactions has offer_id, not product_id)"}'),
  ('home','global','top_in','Best Eat Deals','offers','top_by_conversions','offers','dining',6,7,true,
     '{"sub":"top food offers by conversions"}'),
  ('home','global','top_in','Top Fashion in {city}','brands','top_by_engagement','brands','shopping',8,8,true,
     '{"sub":"top fashion brands by engagement"}'),
  ('home','global','new_this_week','New This Week','mixed','newest',NULL,NULL,8,9,false,
     '{"window_days":7,"sub":"just-joined brands / new offers"}'),
  ('home','global','because_you_follow','Because You Follow','offers','follow_graph',NULL,NULL,8,10,true,
     '{"sub":"live offers from creators you follow"}'),
  ('home','global','biggest_discounts','Biggest Discounts','offers','biggest_discounts',NULL,NULL,8,11,true,
     '{"sub":"highest % off live · your city"}'),
  ('home','global','deals_ending_soon','Deals Ending Soon','offers','ending_soon',NULL,NULL,8,12,true,
     '{"sub":"expiring soonest · all categories"}')
ON CONFLICT DO NOTHING;

-- 🗂️ CATEGORY (default template — category_key injected per :key at request) --
INSERT INTO section_config
  (screen, scope_type, shelf_key, title, shelf_type, rule, item_type, item_limit, position, enabled, config_json)
VALUES
  ('category','global','subcat_chips','{category}','controls','static',NULL,99,1,true,'{"sticky":true}'),
  ('category','global','top_creators','Top {category} Creators','creators','creators_in_category',NULL,8,2,true,NULL),
  ('category','global','popular_businesses','Popular Businesses','brands','top_by_engagement','brands',8,3,true,NULL),
  ('category','global','trending_items','Trending Items','products','top_by_sales','products',8,4,false,
     '{"disabled_reason":"product attribution deferred"}'),
  ('category','global','best_deals','Best {category} Deals','offers','top_by_conversions','offers',8,5,true,NULL),
  ('category','global','filter_bar','Filter / Sort','controls','static',NULL,99,6,true,
     '{"filters":["Offers","Nearest","Top Rated"]}'),
  ('category','global','all_businesses','All Businesses','brands','top_by_engagement','brands',20,7,true,
     '{"main_list":true}')
ON CONFLICT DO NOTHING;

-- 🏷️ OFFERS ------------------------------------------------------------------
INSERT INTO section_config
  (screen, scope_type, shelf_key, title, shelf_type, rule, item_type, item_limit, position, enabled, config_json)
VALUES
  ('offers','global','supercat_chips','Categories','controls','static',NULL,99,1,true,'{"sticky":true}'),
  ('offers','global','sort_bar','Sort','controls','static',NULL,99,2,true,
     '{"sorts":["Best Discount","Ending Soon","Near Me","By Creator"]}'),
  ('offers','global','todays_best_deal','Today''s Best Deal','offers','biggest_discounts',NULL,1,3,true,
     '{"hero":true,"mode":"auto"}'),
  ('offers','global','category_offer_rails','{category} Offers','offers','top_by_conversions','offers',8,4,true,
     '{"repeatable":true}'),
  ('offers','global','all_offers','All Offers','offers','all_offers',NULL,30,5,true,'{"grid":true}')
ON CONFLICT DO NOTHING;

-- 👤 CREATOR STORE -----------------------------------------------------------
INSERT INTO section_config
  (screen, scope_type, shelf_key, title, shelf_type, rule, item_type, item_limit, position, enabled, config_json)
VALUES
  ('creator_store','global','profile_header','{creator}','controls','static',NULL,1,1,true,'{"actions":["follow","share"]}'),
  ('creator_store','global','bio','Bio','controls','static',NULL,1,2,true,'{"hide_if_empty":true}'),
  ('creator_store','global','store_collabs','My Store Collabs','brands','creator_brands','brands',8,3,true,NULL),
  ('creator_store','global','category_tabs','Categories','controls','static',NULL,99,4,true,'{"sticky":true}'),
  ('creator_store','global','what_promotes','What {creator} Promotes','offers','creator_promotes','offers',8,5,true,NULL),
  ('creator_store','global','top_picks','Top Picks by {creator}','offers','creator_top_picks','offers',8,6,true,NULL)
ON CONFLICT DO NOTHING;

-- 🧭 CREATOR'S CATEGORY ------------------------------------------------------
INSERT INTO section_config
  (screen, scope_type, shelf_key, title, shelf_type, rule, item_type, item_limit, position, enabled, config_json)
VALUES
  ('creator_category','global','header','{creator} · {category}','controls','static',NULL,1,1,true,NULL),
  ('creator_category','global','subcat_chips','Types','controls','static',NULL,99,2,true,'{"sticky":true}'),
  ('creator_category','global','partner_businesses','Partner Businesses','brands','creator_brands','brands',8,3,true,NULL),
  ('creator_category','global','picks_in_category','{creator}''s Picks in {category}','offers','creator_promotes','offers',8,4,true,'{"main":true}'),
  ('creator_category','global','top_in_category','{creator}''s Top in {category}','offers','creator_top_picks','offers',8,5,true,NULL)
ON CONFLICT DO NOTHING;

COMMIT;
