-- 139_concept_engine.sql — Concept engine foundation (Post/Concept program P1)
-- Contract: features/concept-p1-engine/ · Plan: Docs/FASHION_REBUILD/POST_CONCEPT_BUILD_PLAN.md
--
-- A CONCEPT is a named product rule addressable as (template × optional leaf).
-- Concepts are NOT hand-authored rows: the DB stores ~47 TEMPLATES; combining
-- them with the 195 fashion leaves yields ~9,200 addressable concepts. A
-- `concepts` row is materialized LAZILY the first time something needs a
-- stable id for the pair (admin pin, creator post in P2) — never pre-generated.
--
-- Template kinds → the 5 discovery families:
--   kind='category' + leaf        → family 1  "Winter Jeans"
--   kind='price'    (leaf NULL)   → family 2  "Under ₹499"
--   kind='offer'    (leaf NULL)   → family 3  "BOGO"
--   kind='price'    + leaf        → family 4  "Jeans Under ₹499"
--   kind='offer'    + leaf        → family 5  "BOGO Jeans"
--
-- Rule semantics (resolved live at read time, never snapshotted):
--   leaf              → brand_products.category_node_id in the leaf's subtree
--   required_tags     → bp.tags @> required_tags (the ONLY teeth seasonal/
--                       occasion/style templates have — empty = no filter,
--                       the template is then a discovery bucket, by design)
--   eff_price_min/max → band on price AFTER best live discount offer
--                       (sectionRules OFFER_BEST_PCT — founder lock 2026-07-22)
--   offer_type        → a live published-to-store brand_offers of that type
--                       applies (+ optional min_discount_pct, e.g. "Flat 40%")
--
-- COLLECTIONS are the 6th family: admin-curated NAMES with NO rule (mixed
-- categories, creator picks one at publish time — founder lock 2026-07-22).
--
-- Ships SEEDED (templates + collection vocabulary) — deploy-visible only in
-- the new admin pages; no follower surface reads any of this yet.

BEGIN;

CREATE TABLE IF NOT EXISTS concept_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text NOT NULL CHECK (kind IN ('category','price','offer')),
  -- grouping for the admin UI; category kind only (seasonal/occasion/style/utility)
  template_group   text,
  -- 'Winter {Category}' (category kind, {Category} required) or a plain name
  -- ('Under ₹499', 'BOGO') for price/offer kinds
  name_pattern     text NOT NULL,
  -- rule teeth (all optional; kind-appropriate subset used)
  required_tags    text[] NOT NULL DEFAULT '{}',
  eff_price_min    numeric(10,2),
  eff_price_max    numeric(10,2),
  offer_type       text CHECK (offer_type IN ('discount','volume','bogo','bundle','free_gift')),
  min_discount_pct numeric(5,2),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, name_pattern)
);

-- Lazily-materialized concept identities (stable FK target for pins now,
-- creator_posts.concept_id in P2). category_node_id NULL = the template alone
-- (families 2/3). The partial unique indexes stand in for a NULL-safe UNIQUE.
CREATE TABLE IF NOT EXISTS concepts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      uuid NOT NULL REFERENCES concept_templates(id) ON DELETE CASCADE,
  category_node_id uuid REFERENCES category_nodes(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_concepts_pair
  ON concepts (template_id, category_node_id) WHERE category_node_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_concepts_solo
  ON concepts (template_id) WHERE category_node_id IS NULL;

-- Family 6 — admin-curated collection vocabulary (no rule; creator picks one).
CREATE TABLE IF NOT EXISTS collections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Seeds: the founder's 47 templates (Follower creator commerce.docx) ───────

INSERT INTO concept_templates (kind, template_group, name_pattern, sort_order) VALUES
  -- Seasonal (4)
  ('category','seasonal','Summer {Category}',   10),
  ('category','seasonal','Winter {Category}',   11),
  ('category','seasonal','Monsoon {Category}',  12),
  ('category','seasonal','Spring {Category}',   13),
  -- Occasion (9)
  ('category','occasion','Office {Category}',     20),
  ('category','occasion','Party {Category}',      21),
  ('category','occasion','Wedding {Category}',    22),
  ('category','occasion','Festive {Category}',    23),
  ('category','occasion','College {Category}',    24),
  ('category','occasion','Airport {Category}',    25),
  ('category','occasion','Vacation {Category}',   26),
  ('category','occasion','Date Night {Category}', 27),
  ('category','occasion','Weekend {Category}',    28),
  -- Style (9)
  ('category','style','Minimal {Category}',      30),
  ('category','style','Casual {Category}',       31),
  ('category','style','Elegant {Category}',      32),
  ('category','style','Classic {Category}',      33),
  ('category','style','Trendy {Category}',       34),
  ('category','style','Street Style {Category}', 35),
  ('category','style','Korean Style {Category}', 36),
  ('category','style','Boho {Category}',         37),
  ('category','style','Vintage {Category}',      38),
  -- Utility (5)
  ('category','utility','Everyday {Category}', 40),
  ('category','utility','Travel {Category}',   41),
  ('category','utility','Gym {Category}',      42),
  ('category','utility','Workwear {Category}', 43),
  ('category','utility','Lounge {Category}',   44)
ON CONFLICT (kind, name_pattern) DO NOTHING;

INSERT INTO concept_templates (kind, name_pattern, eff_price_min, eff_price_max, sort_order) VALUES
  ('price','Under ₹299',  NULL,  299, 50),
  ('price','Under ₹499',  NULL,  499, 51),
  ('price','Under ₹799',  NULL,  799, 52),
  ('price','Under ₹999',  NULL,  999, 53),
  ('price','Under ₹1499', NULL, 1499, 54),
  ('price','Premium Picks', 1500, 4999, 55),
  ('price','Luxury Picks',  5000, NULL, 56),
  ('price','Budget Friendly', NULL, 599, 57),
  ('price','Best Value',      NULL, 999, 58)
ON CONFLICT (kind, name_pattern) DO NOTHING;

INSERT INTO concept_templates (kind, name_pattern, offer_type, min_discount_pct, sort_order) VALUES
  ('offer','BOGO',          'bogo',     NULL, 70),
  ('offer','Flat 20% Off',  'discount',   20, 71),
  ('offer','Flat 30% Off',  'discount',   30, 72),
  ('offer','Flat 40% Off',  'discount',   40, 73),
  ('offer','Flat 50% Off',  'discount',   50, 74),
  ('offer','Flat 60% Off',  'discount',   60, 75),
  ('offer','Buy 2 Get 1',   'bogo',     NULL, 76),
  ('offer','Volume Offers', 'volume',   NULL, 77),
  ('offer','Combo Deals',   'bundle',   NULL, 78),
  ('offer','Free Gift',     'free_gift',NULL, 79),
  ('offer','Clearance',     'discount',   50, 80)
ON CONFLICT (kind, name_pattern) DO NOTHING;

-- Collection vocabulary starter set (founder's examples; admin edits freely)
INSERT INTO collections (name, slug, sort_order) VALUES
  ('Airport Looks',        'airport-looks',        10),
  ('Goa Vacation',         'goa-vacation',         11),
  ('Coffee Date',          'coffee-date',          12),
  ('Office Capsule',       'office-capsule',       13),
  ('Travel Essentials',    'travel-essentials',    14),
  ('Minimal Closet',       'minimal-closet',       15),
  ('Weekend Escape',       'weekend-escape',       16),
  ('Holiday Packing',      'holiday-packing',      17),
  ('Rainy Day Looks',      'rainy-day-looks',      18),
  ('Sunday Brunch',        'sunday-brunch',        19),
  ('College Starter Pack', 'college-starter-pack', 20),
  ('Black & White',        'black-and-white',      21),
  ('All Denim',            'all-denim',            22),
  ('Summer Escape',        'summer-escape',        23)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
