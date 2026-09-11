-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 171 — Item 3: brand profile columns, creator city + niche backfills,
-- city uniqueness, state aliases for Google spellings.
-- Contract: features/item3-discovery-profiles-groups · gap report §5 (170 as proposed)
--
-- WHAT
--   brands.about (≤200), website_url, instagram_handle, contact_person (typed; backfilled
--   from listing_data.contact_person_name which no backend code ever read).
--   influencers.city_id filled by matching the typed city (influencers.city, else users.city)
--   against ref_cities by normalised name. Unmatched rows stay NULL and are LISTED, never
--   auto-added (founder Q8).
--   influencers.niche: 22 of 25 creators carry the item-2 code with a capital letter
--   ('Fashion' …); they are lower-cased so they match ref_creator_niches.
--   ref_cities UNIQUE (state_id, name_norm): two brands adding the same Google city at the
--   same moment cannot create two rows (founder D3).
--   ref_state_aliases: Google's spellings of a state → our state (founder Q9). States are
--   NEVER auto-added; an unknown state is STATE_UNKNOWN.
--
-- Additive + idempotent. No column dropped, renamed or retyped.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Brand profile ────────────────────────────────────────────────────────────
ALTER TABLE brands ADD COLUMN IF NOT EXISTS about text;
ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_about_len;
ALTER TABLE brands ADD CONSTRAINT brands_about_len CHECK (about IS NULL OR char_length(about) <= 200);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS instagram_handle text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS contact_person text;

UPDATE brands
   SET contact_person = trim(listing_data->>'contact_person_name')
 WHERE contact_person IS NULL
   AND NULLIF(trim(listing_data->>'contact_person_name'), '') IS NOT NULL;

COMMENT ON COLUMN brands.about IS 'Item 3: shown on the brand overview to creators. ≤200 characters.';
COMMENT ON COLUMN brands.contact_person IS 'Item 3: typed contact person (was listing_data.contact_person_name). Never shown to creators.';
COMMENT ON COLUMN brands.instagram_handle IS 'Item 3: the brand''s Instagram handle, shown as a link on the brand overview.';

-- ── City list integrity ──────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_cities_state_norm ON ref_cities (state_id, name_norm);

CREATE TABLE IF NOT EXISTS ref_state_aliases (
  alias_norm text PRIMARY KEY,
  state_id   smallint NOT NULL REFERENCES ref_states(id)
);
COMMENT ON TABLE ref_state_aliases IS
  'Google''s spellings of a state → ours (founder Q9). Looked up after an exact name match fails. States are never auto-added.';
INSERT INTO ref_state_aliases (alias_norm, state_id)
SELECT v.alias, s.id FROM (VALUES
  ('nct of delhi', 'Delhi'),
  ('national capital territory of delhi', 'Delhi'),
  ('new delhi', 'Delhi'),
  ('pondicherry', 'Puducherry'),
  ('orissa', 'Odisha'),
  ('uttaranchal', 'Uttarakhand'),
  ('jammu & kashmir', 'Jammu and Kashmir'),
  ('andaman & nicobar islands', 'Andaman and Nicobar Islands'),
  ('andaman & nicobar', 'Andaman and Nicobar Islands'),
  ('dadra & nagar haveli and daman & diu', 'Dadra and Nagar Haveli and Daman and Diu'),
  ('dadra and nagar haveli', 'Dadra and Nagar Haveli and Daman and Diu'),
  ('daman and diu', 'Dadra and Nagar Haveli and Daman and Diu'),
  ('bengaluru urban', 'Karnataka')
) AS v(alias, state) JOIN ref_states s ON s.name = v.state
ON CONFLICT (alias_norm) DO NOTHING;

-- Google states that did not resolve, kept for admin review (founder Q9: log the raw name).
CREATE TABLE IF NOT EXISTS ref_unknown_states (
  id          bigserial PRIMARY KEY,
  raw_state   text,
  raw_city    text,
  place_id    text,
  user_id     uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Creator city → canonical id (name match only; nothing is added) ─────────
UPDATE influencers i
   SET city_id = rc.id
  FROM users u
  JOIN ref_cities rc ON rc.name_norm = lower(trim(u.city))
 WHERE u.id = i.user_id
   AND i.city_id IS NULL
   AND rc.id = (SELECT min(x.id) FROM ref_cities x WHERE x.name_norm = lower(trim(COALESCE(i.city, u.city))));

UPDATE influencers i
   SET city_id = (SELECT min(x.id) FROM ref_cities x WHERE x.name_norm = lower(trim(i.city)))
 WHERE i.city_id IS NULL
   AND i.city IS NOT NULL
   AND EXISTS (SELECT 1 FROM ref_cities x WHERE x.name_norm = lower(trim(i.city)));

-- ── Creator niche: capitalised legacy values → item-2 codes ─────────────────
UPDATE influencers
   SET niche = ARRAY[lower(niche[1])]
 WHERE cardinality(niche) = 1
   AND niche[1] <> lower(niche[1])
   AND lower(niche[1]) IN (SELECT code FROM ref_creator_niches);

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM brands WHERE contact_person IS NOT NULL;              -- 1 today
--   SELECT count(*) FROM influencers WHERE city_id IS NOT NULL;                 -- 25 after mig 170 (22 before it)
--   SELECT count(*) FROM influencers WHERE cardinality(niche)=1 AND niche[1] <> lower(niche[1]);   -- 0
--   SELECT count(*) FROM ref_state_aliases;                                     -- 13
