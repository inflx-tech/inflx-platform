-- 056_meals_schema.sql
-- INFLX Meals — P0 data foundation (contract: features/meals-schema/).
--
-- A restaurant-only PLANNED-meal marketplace layered on INFLX, with its
-- OWN money/data model separate from the influencer commission spine.
-- This migration is SCHEMA ONLY — no API, no UI, no AI. Later phases
-- (P1 vertical slice → P6 learning) read+write these tables.
--
-- Conventions (verified against 001_initial_schema + migration 021):
--   - uuid PKs via gen_random_uuid()
--   - money in RUPEES, numeric(x,2)
--   - updated_at maintained by the existing update_updated_at() trigger fn
--   - additive ONLY (no ALTER/DROP on existing tables) → zero regression
--   - idempotent: IF NOT EXISTS everywhere; enums guarded so the full-order
--     re-apply (dev-db-init / qa:db setup) composes cleanly.

-- ─── Enums (guarded for idempotency — CREATE TYPE has no IF NOT EXISTS) ──────
DO $$ BEGIN
  CREATE TYPE meal_party_size AS ENUM ('single','duo','trio','family','office');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meal_offer_kind AS ENUM ('discount','free_addon','mixed','early_order','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meal_offer_status AS ENUM ('suggested','accepted','rejected','active','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meal_intent_status AS ENUM ('open','clarifying','offered','ordered','no_match','abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meal_presented_status AS ENUM ('presented','selected','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meal_order_status AS ENUM (
    'pending_payment','paid','locked','frozen','preparing',
    'out_for_delivery','delivered','cancelled','refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. restaurant_meal_config (one row per restaurant) ──────────────────────
CREATE TABLE IF NOT EXISTS restaurant_meal_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
  enabled             boolean       DEFAULT false,
  delivery_radius_km  numeric(5,2)  DEFAULT 5.00,
  max_discount_pct    numeric(5,2)  DEFAULT 25.00,
  never_below_cost    boolean       DEFAULT true,
  auto_offer          boolean       DEFAULT false,
  -- editable discount-clock setting (mockup 01): [{ "unit":"hour","n":2,"pct":5 }, ...]
  discount_clock      jsonb         DEFAULT '[]'::jsonb,
  created_at          timestamptz   DEFAULT now(),
  updated_at          timestamptz   DEFAULT now()
);
DO $$ BEGIN
  CREATE TRIGGER restaurant_meal_config_updated_at
    BEFORE UPDATE ON restaurant_meal_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. meal_slots (recurring slot definitions per restaurant) ───────────────
CREATE TABLE IF NOT EXISTS meal_slots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  label                 varchar(40) NOT NULL,          -- e.g. 'Lunch', 'Dinner'
  serve_time            time        NOT NULL,          -- e.g. 13:00
  cutoff_minutes_before int         NOT NULL DEFAULT 120,
  capacity              int         DEFAULT 40,
  days_active           jsonb       DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb,
  is_active             boolean     DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_slots_brand ON meal_slots (brand_id) WHERE is_active;
DO $$ BEGIN
  CREATE TRIGGER meal_slots_updated_at
    BEFORE UPDATE ON meal_slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. meal_offer_rules (deterministic offer definitions) ───────────────────
CREATE TABLE IF NOT EXISTS meal_offer_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name                varchar(120) NOT NULL,
  party_size          meal_party_size NOT NULL,
  offer_kind          meal_offer_kind NOT NULL,
  items_json          jsonb        DEFAULT '[]'::jsonb,  -- [{product_id, name, qty, price}]
  base_price          numeric(10,2),                     -- owner price before levers (rupees)
  discount_type       varchar(20),                       -- 'flat' | 'percentage' | null
  discount_value      numeric(10,2),                     -- rupees or pct per discount_type
  freebies_json       jsonb        DEFAULT '[]'::jsonb,
  photo_url           text,                              -- restaurant-uploaded offer photo
  slot_id             uuid         REFERENCES meal_slots(id) ON DELETE SET NULL,
  custom_description  text,                              -- plain-English source (create-your-own)
  trigger_json        jsonb        DEFAULT '{}'::jsonb,  -- e.g. {weather:'rain', max_km:3}
  source              varchar(20)  DEFAULT 'ai',         -- 'ai' | 'custom' | 'template'
  status              meal_offer_status DEFAULT 'suggested',
  accepted_at         timestamptz,
  rejected_reason     text,
  created_at          timestamptz  DEFAULT now(),
  updated_at          timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_offer_rules_brand_status ON meal_offer_rules (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_meal_offer_rules_party ON meal_offer_rules (brand_id, party_size) WHERE status = 'active';
DO $$ BEGIN
  CREATE TRIGGER meal_offer_rules_updated_at
    BEFORE UPDATE ON meal_offer_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 4. meal_intents (what a customer asked for) ─────────────────────────────
CREATE TABLE IF NOT EXISTS meal_intents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id     uuid REFERENCES followers(id) ON DELETE SET NULL,
  brand_id        uuid REFERENCES brands(id) ON DELETE SET NULL,  -- null = cross-restaurant chat
  party_size      meal_party_size,
  veg_count       int,
  nonveg_count    int,
  items_json      jsonb       DEFAULT '[]'::jsonb,
  spice_level     varchar(20),
  occasion        varchar(40),
  drop_location   jsonb       DEFAULT '{}'::jsonb,  -- {label, lat, lng, address}
  slot_date       date,
  slot_label      varchar(40),
  budget_per_head numeric(10,2),
  raw_text        text,
  parsed_json     jsonb       DEFAULT '{}'::jsonb,  -- AI-extracted structure
  status          meal_intent_status DEFAULT 'open',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_intents_follower ON meal_intents (follower_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_intents_brand ON meal_intents (brand_id) WHERE brand_id IS NOT NULL;
DO $$ BEGIN
  CREATE TRIGGER meal_intents_updated_at
    BEFORE UPDATE ON meal_intents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 5. meal_offers (ranked shortlist presented for an intent) ───────────────
CREATE TABLE IF NOT EXISTS meal_offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id       uuid NOT NULL REFERENCES meal_intents(id) ON DELETE CASCADE,
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  offer_rule_id   uuid REFERENCES meal_offer_rules(id) ON DELETE SET NULL,
  items_json      jsonb       DEFAULT '[]'::jsonb,
  price           numeric(10,2) NOT NULL,            -- rupees, deterministic-computed
  original_price  numeric(10,2),
  freebies_json   jsonb       DEFAULT '[]'::jsonb,
  eta_text        varchar(60),
  rank            int,
  ai_recommended  boolean     DEFAULT false,
  reasoning       text,                              -- why AI ranked/recommended (display)
  status          meal_presented_status DEFAULT 'presented',
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_offers_intent ON meal_offers (intent_id, rank);
-- ─── 6. meal_orders (locked + paid) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_offer_id     uuid REFERENCES meal_offers(id) ON DELETE SET NULL,
  intent_id         uuid REFERENCES meal_intents(id) ON DELETE SET NULL,
  follower_id       uuid NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  brand_id          uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  slot_id           uuid REFERENCES meal_slots(id) ON DELETE SET NULL,
  slot_date         date NOT NULL,
  party_size        meal_party_size,
  items_json        jsonb        DEFAULT '[]'::jsonb,
  amount            numeric(10,2) NOT NULL,          -- rupees the customer pays
  commission_pct    numeric(5,2),                    -- platform fee % (P-REV sets default later)
  commission_amount numeric(10,2),                   -- rupees — separate from influencer commission
  delivery_address  jsonb        DEFAULT '{}'::jsonb,
  distance_km       numeric(5,2),
  status            meal_order_status DEFAULT 'pending_payment',
  cutoff_at         timestamptz,
  paid_at           timestamptz,
  created_at        timestamptz  DEFAULT now(),
  updated_at        timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_orders_slot_book ON meal_orders (brand_id, slot_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_meal_orders_follower ON meal_orders (follower_id, created_at DESC);
DO $$ BEGIN
  CREATE TRIGGER meal_orders_updated_at
    BEFORE UPDATE ON meal_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 7. meal_restaurant_learnings (owner-confirmed + AI-inferred memory) ─────
CREATE TABLE IF NOT EXISTS meal_restaurant_learnings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  brand_product_id uuid REFERENCES brand_products(id) ON DELETE CASCADE,
  learning_type    varchar(40) NOT NULL,  -- cost|floor|discount_appetite|freebie_willingness|rejected_reason|standing_note
  key              varchar(120),
  value_json       jsonb       DEFAULT '{}'::jsonb,
  confidence       numeric(4,3),
  owner_confirmed  boolean     DEFAULT false,  -- money facts confirmed by owner, never AI-guessed
  source           varchar(20) DEFAULT 'ai',   -- 'owner' | 'ai'
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_learnings_brand_type ON meal_restaurant_learnings (brand_id, learning_type);
DO $$ BEGIN
  CREATE TRIGGER meal_restaurant_learnings_updated_at
    BEFORE UPDATE ON meal_restaurant_learnings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 8. meal_customer_preferences (one row per follower) ─────────────────────
CREATE TABLE IF NOT EXISTS meal_customer_preferences (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id         uuid NOT NULL UNIQUE REFERENCES followers(id) ON DELETE CASCADE,
  spice_pref          varchar(20),
  veg_pref            varchar(20),
  budget_per_head     numeric(10,2),
  favourite_brand_ids uuid[]      DEFAULT '{}',
  cuisines            text[]      DEFAULT '{}',
  prefs_json          jsonb       DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
DO $$ BEGIN
  CREATE TRIGGER meal_customer_preferences_updated_at
    BEFORE UPDATE ON meal_customer_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 9. meal_conversations (short-term chat state) ───────────────────────────
CREATE TABLE IF NOT EXISTS meal_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id     uuid REFERENCES followers(id) ON DELETE CASCADE,
  brand_id        uuid REFERENCES brands(id) ON DELETE SET NULL,
  state_json      jsonb       DEFAULT '{}'::jsonb,
  last_intent_id  uuid REFERENCES meal_intents(id) ON DELETE SET NULL,
  status          varchar(20) DEFAULT 'active',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meal_conversations_follower ON meal_conversations (follower_id, updated_at DESC);
DO $$ BEGIN
  CREATE TRIGGER meal_conversations_updated_at
    BEFORE UPDATE ON meal_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
