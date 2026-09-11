-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 168 — Item 2: reference lists (niches, languages, brand sub-categories,
-- states → cities) and the two profile columns the eligibility rules read.
-- Contract: features/item2-pitch-invitation-settings · rules doc v1.10 §8A
-- Gap report: Docs/ITEM2_SETTINGS_GAP_REPORT.md (D4)
--
-- WHY
-- Until now every list a setting could point at lived somewhere it could not be
-- shared: niches and languages were arrays typed into one phone screen, states were
-- two divergent arrays (app vs website), cities were free text, and the eight fashion
-- sub-categories did not exist at all — the brand's category is the single word
-- 'fashion'. A brand's "creator niches" filter and a creator's "cities I can visit"
-- both need one list both sides read.
--
-- Founder decisions (INFLX_Item2_Approval_Message.md, 2026-09-11):
--   Q4  creator niches are GENERAL content niches (20 seeded); one required per creator
--   Q4b languages: keep today's 10
--   Q5  a brand picks Fashion, then one or more of the 8 sub-categories (required)
--   Q6  states/cities seeded from inflx_states_cities.csv (17 states, 63 cities);
--       ref_cities carries source + created_at so the list can grow without a migration
--
-- Additive + idempotent. No column dropped, renamed or retyped. No row touched.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS ref_creator_niches (
  code    text PRIMARY KEY,
  label   text NOT NULL,
  sort    integer NOT NULL DEFAULT 0,
  active  boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE ref_creator_niches IS
  'General content niches (rules v1.10 §8A). A creator picks exactly one; a brand''s pitch filter picks any subset. Seeded from backend/seeds/creator_niches.csv; admin adds more later.';

CREATE TABLE IF NOT EXISTS ref_languages (
  code    text PRIMARY KEY,
  label   text NOT NULL,
  sort    integer NOT NULL DEFAULT 0,
  active  boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE ref_languages IS
  'Languages a creator makes content in. code = label because influencers.language has always stored the label (e.g. ''Hindi'').';

CREATE TABLE IF NOT EXISTS ref_brand_categories (
  code    text PRIMARY KEY,
  label   text NOT NULL,
  sort    integer NOT NULL DEFAULT 0
);
COMMENT ON TABLE ref_brand_categories IS
  'The eight fashion sub-categories (rules v1.10 §8A). Also the "industries" a creator sets a minimum commission per.';

CREATE TABLE IF NOT EXISTS ref_states (
  id      smallserial PRIMARY KEY,
  name    text UNIQUE NOT NULL,
  sort    integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ref_cities (
  id          serial PRIMARY KEY,
  state_id    smallint NOT NULL REFERENCES ref_states(id),
  name        text NOT NULL,
  name_norm   text NOT NULL,                               -- lower(trim(name)); matches typed cities
  sort        integer NOT NULL DEFAULT 0,
  source      text NOT NULL DEFAULT 'seed' CHECK (source IN ('seed','google','admin')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_id, name)
);
CREATE INDEX IF NOT EXISTS idx_ref_cities_norm ON ref_cities (name_norm);
COMMENT ON TABLE ref_cities IS
  'Canonical city list, shared by brand branches, the brand''s Cities filter and the creator''s visit cities. Starts with major cities in selected states and grows: source=google rows will be added from brand addresses in a later item.';

-- ── Seeds ────────────────────────────────────────────────────────────────────
INSERT INTO ref_brand_categories (code, label, sort) VALUES
  ('MEN',                 'Men',                1),
  ('WOMEN',               'Women',              2),
  ('KIDS',                'Kids',               3),
  ('PLUS_SIZE',           'Plus Size',          4),
  ('WATCHES',             'Watches',            5),
  ('IMITATION_JEWELLERY', 'Imitation Jewellery',6),
  ('FOOTWEAR',            'Footwear',           7),
  ('BAGS_ACCESSORIES',    'Bags & Accessories', 8)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ref_languages (code, label, sort) VALUES
  ('Hindi','Hindi',1), ('English','English',2), ('Tamil','Tamil',3), ('Telugu','Telugu',4),
  ('Kannada','Kannada',5), ('Malayalam','Malayalam',6), ('Marathi','Marathi',7),
  ('Bengali','Bengali',8), ('Gujarati','Gujarati',9), ('Punjabi','Punjabi',10)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ref_creator_niches (code, label, sort) VALUES
  ('comedy', 'Comedy', 1),
  ('couple_comedy', 'Couple comedy', 2),
  ('daily_vlogs', 'Daily vlogs', 3),
  ('lifestyle', 'Lifestyle', 4),
  ('fashion', 'Fashion', 5),
  ('beauty', 'Beauty & makeup', 6),
  ('food', 'Food vlogging', 7),
  ('travel', 'Travel', 8),
  ('fitness', 'Fitness', 9),
  ('tech', 'Tech', 10),
  ('gaming', 'Gaming', 11),
  ('motor', 'Motor & auto', 12),
  ('education', 'Education', 13),
  ('finance', 'Finance', 14),
  ('parenting', 'Parenting & family', 15),
  ('home_decor', 'Home decor', 16),
  ('music_dance', 'Music & dance', 17),
  ('entertainment', 'Movies & entertainment', 18),
  ('sports', 'Sports', 19),
  ('art_diy', 'Art & DIY', 20)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ref_states (name, sort) VALUES
  ('Andhra Pradesh', 1),
  ('Telangana', 2),
  ('Karnataka', 3),
  ('Tamil Nadu', 4),
  ('Kerala', 5),
  ('Maharashtra', 6),
  ('Delhi', 7),
  ('Gujarat', 8),
  ('West Bengal', 9),
  ('Uttar Pradesh', 10),
  ('Rajasthan', 11),
  ('Haryana', 12),
  ('Punjab', 13),
  ('Chandigarh', 14),
  ('Madhya Pradesh', 15),
  ('Odisha', 16),
  ('Goa', 17)
ON CONFLICT (name) DO NOTHING;

INSERT INTO ref_cities (state_id, name, name_norm, sort, source)
SELECT s.id, v.city, lower(v.city), v.sort, 'seed'
FROM (VALUES
  ('Andhra Pradesh', 'Visakhapatnam', 1),
  ('Andhra Pradesh', 'Vijayawada', 2),
  ('Andhra Pradesh', 'Guntur', 3),
  ('Andhra Pradesh', 'Nellore', 4),
  ('Andhra Pradesh', 'Tirupati', 5),
  ('Andhra Pradesh', 'Kurnool', 6),
  ('Andhra Pradesh', 'Rajahmundry', 7),
  ('Andhra Pradesh', 'Kakinada', 8),
  ('Andhra Pradesh', 'Kadapa', 9),
  ('Andhra Pradesh', 'Anantapur', 10),
  ('Telangana', 'Hyderabad', 1),
  ('Telangana', 'Warangal', 2),
  ('Telangana', 'Karimnagar', 3),
  ('Telangana', 'Nizamabad', 4),
  ('Telangana', 'Khammam', 5),
  ('Telangana', 'Mahbubnagar', 6),
  ('Karnataka', 'Bengaluru', 1),
  ('Karnataka', 'Mysuru', 2),
  ('Karnataka', 'Mangaluru', 3),
  ('Karnataka', 'Hubballi', 4),
  ('Karnataka', 'Belagavi', 5),
  ('Tamil Nadu', 'Chennai', 1),
  ('Tamil Nadu', 'Coimbatore', 2),
  ('Tamil Nadu', 'Madurai', 3),
  ('Tamil Nadu', 'Tiruchirappalli', 4),
  ('Tamil Nadu', 'Salem', 5),
  ('Kerala', 'Kochi', 1),
  ('Kerala', 'Thiruvananthapuram', 2),
  ('Kerala', 'Kozhikode', 3),
  ('Kerala', 'Thrissur', 4),
  ('Maharashtra', 'Mumbai', 1),
  ('Maharashtra', 'Pune', 2),
  ('Maharashtra', 'Nagpur', 3),
  ('Maharashtra', 'Nashik', 4),
  ('Maharashtra', 'Thane', 5),
  ('Delhi', 'New Delhi', 1),
  ('Gujarat', 'Ahmedabad', 1),
  ('Gujarat', 'Surat', 2),
  ('Gujarat', 'Vadodara', 3),
  ('Gujarat', 'Rajkot', 4),
  ('West Bengal', 'Kolkata', 1),
  ('West Bengal', 'Howrah', 2),
  ('West Bengal', 'Siliguri', 3),
  ('Uttar Pradesh', 'Lucknow', 1),
  ('Uttar Pradesh', 'Noida', 2),
  ('Uttar Pradesh', 'Ghaziabad', 3),
  ('Uttar Pradesh', 'Kanpur', 4),
  ('Uttar Pradesh', 'Varanasi', 5),
  ('Uttar Pradesh', 'Agra', 6),
  ('Rajasthan', 'Jaipur', 1),
  ('Rajasthan', 'Jodhpur', 2),
  ('Rajasthan', 'Udaipur', 3),
  ('Haryana', 'Gurugram', 1),
  ('Haryana', 'Faridabad', 2),
  ('Punjab', 'Ludhiana', 1),
  ('Punjab', 'Amritsar', 2),
  ('Punjab', 'Jalandhar', 3),
  ('Chandigarh', 'Chandigarh', 1),
  ('Madhya Pradesh', 'Indore', 1),
  ('Madhya Pradesh', 'Bhopal', 2),
  ('Odisha', 'Bhubaneswar', 1),
  ('Odisha', 'Cuttack', 2),
  ('Goa', 'Panaji', 1)
) AS v(state, city, sort)
JOIN ref_states s ON s.name = v.state
ON CONFLICT (state_id, name) DO NOTHING;

-- ── Profile columns the rules read ───────────────────────────────────────────
-- The brand's sub-categories. NULL/empty = never chosen. Required at registration from
-- now on (Q5b); existing brands set theirs in Business details. Rule 3.2.3: a brand
-- with none set does not match a creator who picked categories (Q5c).
ALTER TABLE brands ADD COLUMN IF NOT EXISTS sub_categories text[];
COMMENT ON COLUMN brands.sub_categories IS
  'Codes from ref_brand_categories (rules v1.10 §8A). Required at registration since item 2; NULL means an older brand that has not chosen yet — treated as matching no creator category filter.';

-- Canonical city for a creator. Optional in item 2 (typed users.city / influencers.city
-- is matched by name); item 3 switches the profile to the picker and writes this.
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS city_id integer REFERENCES ref_cities(id);

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM ref_brand_categories;   -- 8
--   SELECT count(*) FROM ref_creator_niches;     -- 20
--   SELECT count(*) FROM ref_languages;          -- 10
--   SELECT count(*) FROM ref_states;             -- 17
--   SELECT count(*) FROM ref_cities;             -- 63
