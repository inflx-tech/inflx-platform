-- 193_offer_builder_v2.sql
-- Contract: features/offer-builder-v2 · Docs/OFFER_TERMS_POSTS_RULES.md §1 (v1.4)
--
-- Level 1 of the offer -> terms -> posts programme: offers rebuilt on PRODUCT POOLS with LOCKING.
-- One product, one offer at a time (principle P2) is enforced by the DATABASE, not by discipline:
-- two exclusion constraints refuse any product (or gift item) sitting in two published offers
-- whose days overlap. Drafts lock nothing (rules 1.5): a draft has no frozen pool rows at all.
--
-- Parts:
--   1. btree_gist                 — lets an exclusion constraint compare uuids with "=";
--   2. brand_offers               — the v2 columns (engine, sub-type, the two required dates,
--                                   auto-add, exclusions, published/ended stamps), status widened;
--   3. the clean break (rules 1.13) — every existing offer is archived and taken off the store;
--   4. gift_items                 — things a brand gives away but never sells (rules 1.7);
--   5. offer_pool_sources         — how the brand built the pool (category all / pick / filters,
--                                   search, "put in offer", gift items); the recipe while drafting;
--   6. offer_pool_items           — the pool, FROZEN at publish, with the locked days;
--   7. collab_offers              — offers LINKED to a collaboration (rules 2.3). Created here so
--                                   the offer page can count creators and tell them when the
--                                   offer ends or loses products; Level 2 (creator terms) writes it.
--
-- MONEY: none moves. Checkout does not read any of the new tables (every purchase goes through a
-- creator's post — Level 3). scripts/run-193.js reads counts before and after.
-- Idempotent: every statement is IF NOT EXISTS / guarded; proved by applying it twice.

BEGIN;

-- ─── 1. The extension ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── 2. brand_offers, v2 ──────────────────────────────────────────────────────
-- engine = 1: the old offer builder (archived below, read by nothing new);
-- engine = 2: this builder. Scheduled / Live / Ended are DERIVED from the two dates in India time;
-- only an early end is stored ('ended' + ended_at).
ALTER TABLE brand_offers ADD COLUMN IF NOT EXISTS engine smallint NOT NULL DEFAULT 1;
ALTER TABLE brand_offers ADD COLUMN IF NOT EXISTS sub_type text;
ALTER TABLE brand_offers ADD COLUMN IF NOT EXISTS starts_on date;
ALTER TABLE brand_offers ADD COLUMN IF NOT EXISTS ends_on date;
ALTER TABLE brand_offers ADD COLUMN IF NOT EXISTS auto_add boolean NOT NULL DEFAULT false;
ALTER TABLE brand_offers ADD COLUMN IF NOT EXISTS excluded_product_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE brand_offers ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE brand_offers ADD COLUMN IF NOT EXISTS ended_at timestamptz;

ALTER TABLE brand_offers DROP CONSTRAINT IF EXISTS brand_offers_status_check;
ALTER TABLE brand_offers ADD CONSTRAINT brand_offers_status_check
  CHECK (status IN ('draft', 'active', 'archived', 'published', 'ended'));

ALTER TABLE brand_offers DROP CONSTRAINT IF EXISTS brand_offers_v2_sub_type;
ALTER TABLE brand_offers ADD CONSTRAINT brand_offers_v2_sub_type CHECK (
  sub_type IS NULL OR
  (offer_type = 'discount'  AND sub_type IN ('percentage', 'flat')) OR
  (offer_type = 'bogo'      AND sub_type = 'bogo') OR
  (offer_type = 'volume'    AND sub_type IN ('quantity', 'value')) OR
  (offer_type = 'bundle'    AND sub_type IN ('pick_any', 'mix_match', 'fixed')) OR
  (offer_type = 'free_gift' AND sub_type IN ('spend', 'buy_x'))
);

-- Rules 1.3: the end must be after the start.
ALTER TABLE brand_offers DROP CONSTRAINT IF EXISTS brand_offers_v2_dates;
ALTER TABLE brand_offers ADD CONSTRAINT brand_offers_v2_dates
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on > starts_on);

-- A published (or ended) v2 offer always has its sub-type and both dates.
ALTER TABLE brand_offers DROP CONSTRAINT IF EXISTS brand_offers_v2_published_complete;
ALTER TABLE brand_offers ADD CONSTRAINT brand_offers_v2_published_complete CHECK (
  engine <> 2 OR status = 'draft' OR
  (sub_type IS NOT NULL AND starts_on IS NOT NULL AND ends_on IS NOT NULL AND published_at IS NOT NULL)
);
-- v2 never uses the retired statuses.
ALTER TABLE brand_offers DROP CONSTRAINT IF EXISTS brand_offers_v2_statuses;
ALTER TABLE brand_offers ADD CONSTRAINT brand_offers_v2_statuses
  CHECK (engine <> 2 OR status IN ('draft', 'published', 'ended'));

CREATE INDEX IF NOT EXISTS idx_brand_offers_v2 ON brand_offers (brand_id, engine, status);

-- ─── 3. The clean break (rules 1.13) ──────────────────────────────────────────
-- Existing offers are old shapes (whole-store scopes, store publishing, availing modes). They are
-- archived and taken off the store. Copies already written onto collaborations are untouched.
UPDATE brand_offers
   SET status = 'archived', published_to_store = false, updated_at = now()
 WHERE engine = 1 AND (status <> 'archived' OR published_to_store);

-- ─── 4. Gift items (rules 1.7) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name        varchar(120) NOT NULL CHECK (length(trim(name)) > 0),
  photo_url   text,
  value       numeric(10,2) NOT NULL CHECK (value > 0),
  stock       integer NOT NULL CHECK (stock >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gift_items_brand ON gift_items (brand_id);

-- ─── 5. How the pool was built ────────────────────────────────────────────────
-- category_all / category_filter are resolved LIVE while drafting (and feed auto-add after
-- publishing); category_pick / search / picked name their products; gift_items names gift items.
-- filters: { leaf_ids: [uuid], brands: [text], price_min: n, price_max: n } — AND across kinds.
CREATE TABLE IF NOT EXISTS offer_pool_sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id          uuid NOT NULL REFERENCES brand_offers(id) ON DELETE CASCADE,
  pool              text NOT NULL CHECK (pool IN ('buy', 'gift')),
  method            text NOT NULL CHECK (method IN
                      ('category_all', 'category_pick', 'category_filter', 'search', 'picked', 'gift_items')),
  category_node_id  uuid REFERENCES category_nodes(id) ON DELETE SET NULL,
  filters           jsonb NOT NULL DEFAULT '{}'::jsonb,
  query             text,
  product_ids       uuid[] NOT NULL DEFAULT '{}',
  gift_item_ids     uuid[] NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (method <> 'gift_items' OR pool = 'gift')
);
CREATE INDEX IF NOT EXISTS idx_offer_pool_sources_offer ON offer_pool_sources (offer_id, created_at);

-- ─── 6. The frozen pool, and the lock ─────────────────────────────────────────
-- lock_days is [starts_on, ends_on + 1) at publish; ending early shortens it to end TODAY (the
-- products are free from today); removing a product stamps removed_at, which frees it at once.
-- The two EXCLUDE constraints are the lock: no product, and no gift item, can be in two pools
-- whose days overlap. Because a product can only appear once per span, the same product can't
-- be in an offer's buy pool and its gift pool either (rules 1.8).
CREATE TABLE IF NOT EXISTS offer_pool_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id         uuid NOT NULL REFERENCES brand_offers(id) ON DELETE CASCADE,
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  pool             text NOT NULL CHECK (pool IN ('buy', 'gift')),
  product_id       uuid REFERENCES brand_products(id) ON DELETE CASCADE,
  gift_item_id     uuid REFERENCES gift_items(id) ON DELETE CASCADE,
  source_id        uuid REFERENCES offer_pool_sources(id) ON DELETE SET NULL,
  quantity         integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  gift_limit       integer CHECK (gift_limit IS NULL OR gift_limit >= 1),
  gifts_given      integer NOT NULL DEFAULT 0 CHECK (gifts_given >= 0),
  price_at_publish numeric(10,2),
  lock_days        daterange NOT NULL,
  added_by         text NOT NULL DEFAULT 'publish' CHECK (added_by IN ('publish', 'auto_add')),
  added_at         timestamptz NOT NULL DEFAULT now(),
  removed_at       timestamptz,
  CONSTRAINT offer_pool_items_one_kind CHECK ((product_id IS NULL) <> (gift_item_id IS NULL)),
  CONSTRAINT offer_pool_items_gift_item_in_gift_pool CHECK (gift_item_id IS NULL OR pool = 'gift'),
  CONSTRAINT offer_items_one_offer_per_product
    EXCLUDE USING gist (product_id WITH =, lock_days WITH &&)
    WHERE (product_id IS NOT NULL AND removed_at IS NULL),
  CONSTRAINT offer_items_one_offer_per_gift_item
    EXCLUDE USING gist (gift_item_id WITH =, lock_days WITH &&)
    WHERE (gift_item_id IS NOT NULL AND removed_at IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_offer_pool_items_offer ON offer_pool_items (offer_id, pool) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_offer_pool_items_product ON offer_pool_items (product_id) WHERE removed_at IS NULL;

-- ─── 7. Offers linked to a collaboration (rules 2.3: linked, not copied) ─────
-- Level 1 only READS this (creators given an offer; who to tell when it ends or loses products).
CREATE TABLE IF NOT EXISTS collab_offers (
  campaign_influencer_id uuid NOT NULL REFERENCES campaign_influencers(id) ON DELETE CASCADE,
  offer_id               uuid NOT NULL REFERENCES brand_offers(id) ON DELETE RESTRICT,
  linked_at              timestamptz NOT NULL DEFAULT now(),
  dropped_at             timestamptz,
  PRIMARY KEY (campaign_influencer_id, offer_id)
);
CREATE INDEX IF NOT EXISTS idx_collab_offers_offer ON collab_offers (offer_id) WHERE dropped_at IS NULL;

COMMIT;
