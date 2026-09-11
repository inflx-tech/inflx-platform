-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 172 — Item 3: branches get their own table.
-- Contract: features/item3-discovery-profiles-groups · rules v1.11 §8A, §11.1 · gap report D2
--
-- THE GAP
-- Branches lived as free text inside brands.listing_data.branches[] — seven keys, no id,
-- no main flag, no place id, a city that only matched by spelling. One thing read them
-- (item 2's Store Visit city match, by name) and the public shopper store leaked the
-- whole array, branch phones included, to anyone (follower.service.js:745).
--
-- THE TABLE
-- One row per branch, exactly one main per brand (partial unique index), city and state
-- as ids on the canonical lists, the Google place id and coordinates kept for the shoot
-- plan later. Creators only ever see city names.
--
-- BACKFILL, TWO PASSES, NOTHING INVENTED
--   1. Every JSON branch becomes a row. Its city/state are matched by name; an unmatched
--      city stays NULL and is listed for the founder (Q8: never auto-added).
--   2. A brand with no JSON branch at all gets ONE main branch from what registration
--      captured: users.city/state, brands.address_line/pincode/lat/lng. A brand with no
--      city at all still gets the row, city NULL — the app shows the orange reminder.
-- The old JSON key is left in place, untouched. Item 3 stops WRITING it; the website's
-- branch editor keeps writing it with no effect on this table (website discussion later).
--
-- Additive + idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS brand_branches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name              text NOT NULL,
  google_place_id   text,
  formatted_address text,
  pincode           text,
  lat               numeric(10,6),
  lng               numeric(10,6),
  city_id           integer REFERENCES ref_cities(id),
  state_id          smallint REFERENCES ref_states(id),
  is_main           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_branches_one_main ON brand_branches (brand_id) WHERE is_main;
CREATE INDEX IF NOT EXISTS idx_brand_branches_brand ON brand_branches (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_branches_city  ON brand_branches (city_id);
COMMENT ON TABLE brand_branches IS
  'Item 3. A brand''s store locations. Exactly one main per brand. Creators see city names only; the full address goes out only with a shoot plan.';

-- ── Pass 1: JSON branches → rows ─────────────────────────────────────────────
INSERT INTO brand_branches (brand_id, name, formatted_address, pincode, lat, lng, city_id, state_id, is_main, created_at)
SELECT b.id,
       COALESCE(NULLIF(trim(br->>'name'), ''), 'Branch ' || (ord)::text),
       NULLIF(trim(br->>'address'), ''),
       NULLIF(trim(br->>'pincode'), ''),
       CASE WHEN ord = 1 THEN b.lat END,
       CASE WHEN ord = 1 THEN b.lng END,
       (SELECT min(c.id) FROM ref_cities c
         WHERE c.name_norm = lower(trim(br->>'city'))
           AND (br->>'state' IS NULL OR c.state_id = (SELECT s.id FROM ref_states s WHERE lower(s.name) = lower(trim(br->>'state')) LIMIT 1)
                OR NOT EXISTS (SELECT 1 FROM ref_states s WHERE lower(s.name) = lower(trim(br->>'state'))))),
       (SELECT s.id FROM ref_states s WHERE lower(s.name) = lower(trim(br->>'state')) LIMIT 1),
       (ord = 1),
       b.created_at
  FROM brands b,
       LATERAL jsonb_array_elements(COALESCE(b.listing_data->'branches', '[]'::jsonb)) WITH ORDINALITY AS t(br, ord)
 WHERE NOT EXISTS (SELECT 1 FROM brand_branches x WHERE x.brand_id = b.id);

-- ── Pass 2: a main branch for every brand that has none ─────────────────────
INSERT INTO brand_branches (brand_id, name, formatted_address, pincode, lat, lng, city_id, state_id, is_main, created_at)
SELECT b.id,
       'Main Branch',
       NULLIF(trim(COALESCE(b.formatted_address, b.address_line)), ''),
       NULLIF(trim(b.pincode), ''),
       b.lat, b.lng,
       (SELECT min(c.id) FROM ref_cities c WHERE c.name_norm = lower(trim(u.city))),
       (SELECT s.id FROM ref_states s WHERE lower(s.name) = lower(trim(u.state)) LIMIT 1),
       true,
       b.created_at
  FROM brands b JOIN users u ON u.id = b.user_id
 WHERE NOT EXISTS (SELECT 1 FROM brand_branches x WHERE x.brand_id = b.id);

-- A brand whose JSON had branches but none flagged main (cannot happen with ord = 1, kept as a guard).
UPDATE brand_branches x SET is_main = true
 WHERE x.id = (SELECT min(y.id::text)::uuid FROM brand_branches y WHERE y.brand_id = x.brand_id)
   AND NOT EXISTS (SELECT 1 FROM brand_branches z WHERE z.brand_id = x.brand_id AND z.is_main);

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM brands b WHERE (SELECT count(*) FROM brand_branches x WHERE x.brand_id=b.id AND x.is_main) <> 1;  -- 0
--   SELECT b.business_name, x.name, x.city_id FROM brand_branches x JOIN brands b ON b.id=x.brand_id WHERE x.city_id IS NULL;  -- the unmatched list
