-- 195_shoppable_posts_v2.sql
-- Contract: features/shoppable-posts-v2 · Docs/OFFER_TERMS_POSTS_RULES.md §4 (v1.4)
--
-- Level 3 of the offer -> terms -> posts programme: a creator makes shoppable posts for ONE
-- collaboration — an offer post (one of her offers) or a price post (her products without offers).
--
-- Parts:
--   1. price_bands   — the five bands set by INFLX (4.4), "under" = up to and including max_price;
--   2. theme_tags    — the 27 tags in four groups (4.5);
--   3. creator_posts — new posts are rows with v2 = true, tied to a collaboration, a brand, a kind
--                      (offer | price) and, for an offer post, the offer. Drafts, "removed", the
--                      facets (category leaves, top price, band), theme tags, the media layout;
--   4. post_media    — mime, size and duration (video, up to 90 s a clip);
--   5. creator_collections + creator_collection_items — her own collections (4.11): posts OR
--      products, each product remembering the collaboration it came from (M6).
--
-- ADDITIVE. Old posts keep every value they have; the old "concept or collection" check applies
-- to old rows only. MONEY: none moves. scripts/run-195.js reads it before and after.

BEGIN;

/* 1 ── price bands (4.4) */
CREATE TABLE IF NOT EXISTS price_bands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL UNIQUE,
  min_price   numeric(10,2) NOT NULL DEFAULT 0,
  max_price   numeric(10,2),                 -- NULL = no top (₹3,000+)
  sort_order  integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (max_price IS NULL OR max_price >= min_price)
);
INSERT INTO price_bands (label, min_price, max_price, sort_order) VALUES
  ('Under ₹499',     0,  499, 1),
  ('Under ₹999',     0,  999, 2),
  ('Under ₹1,999',   0, 1999, 3),
  ('Under ₹2,999',   0, 2999, 4),
  ('₹3,000+',     3000, NULL, 5)
ON CONFLICT (label) DO NOTHING;

/* 2 ── theme tags (4.5) */
CREATE TABLE IF NOT EXISTS theme_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_group   text NOT NULL CHECK (tag_group IN ('season', 'occasion', 'style', 'use')),
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_group, name)
);
INSERT INTO theme_tags (tag_group, name, sort_order) VALUES
  ('season', 'Summer', 1), ('season', 'Winter', 2), ('season', 'Monsoon', 3), ('season', 'Spring', 4),
  ('occasion', 'Office', 1), ('occasion', 'Party', 2), ('occasion', 'Wedding', 3), ('occasion', 'Festive', 4),
  ('occasion', 'College', 5), ('occasion', 'Airport', 6), ('occasion', 'Vacation', 7), ('occasion', 'Date Night', 8),
  ('occasion', 'Weekend', 9),
  ('style', 'Minimal', 1), ('style', 'Casual', 2), ('style', 'Elegant', 3), ('style', 'Classic', 4), ('style', 'Trendy', 5),
  ('style', 'Street Style', 6), ('style', 'Korean Style', 7), ('style', 'Boho', 8), ('style', 'Vintage', 9),
  ('use', 'Everyday', 1), ('use', 'Travel', 2), ('use', 'Gym', 3), ('use', 'Workwear', 4), ('use', 'Lounge', 5)
ON CONFLICT (tag_group, name) DO NOTHING;

/* 3 ── creator_posts: the new kind */
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS v2 boolean NOT NULL DEFAULT false;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS campaign_influencer_id uuid REFERENCES campaign_influencers(id) ON DELETE CASCADE;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS post_kind text;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES brand_offers(id) ON DELETE RESTRICT;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS theme_tag_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS media_layout text;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS category_node_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS top_price numeric(10,2);
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS price_band_id uuid REFERENCES price_bands(id);
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS draft_step integer;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS draft_state jsonb NOT NULL DEFAULT '{}';
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS sent_back_count integer NOT NULL DEFAULT 0;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS removed_reason text;

ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_post_kind_known;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_post_kind_known
  CHECK (post_kind IS NULL OR post_kind IN ('offer', 'price'));
ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_media_layout_known;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_media_layout_known
  CHECK (media_layout IS NULL OR media_layout IN ('single', 'carousel'));
ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_removed_reason_known;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_removed_reason_known
  CHECK (removed_reason IS NULL OR removed_reason IN ('offer_ended', 'products_removed', 'unavailable', 'sold_out', 'taken_down'));

-- 'removed' joins the states (a post that left the shop; final).
ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_status_check;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'removed'));

-- The old "concept XOR collection" rule is for old posts only.
ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_check;
ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_concept_or_collection;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_concept_or_collection
  CHECK (v2 OR ((concept_id IS NOT NULL) <> (collection_id IS NOT NULL)));

-- A new post always belongs to one collaboration and one brand, and never to a concept.
ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_v2_shape;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_v2_shape
  CHECK (NOT v2 OR (campaign_influencer_id IS NOT NULL AND brand_id IS NOT NULL
                    AND concept_id IS NULL AND collection_id IS NULL));
-- A price post never carries an offer; a removed post says why.
ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_v2_price_no_offer;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_v2_price_no_offer
  CHECK (post_kind IS DISTINCT FROM 'price' OR offer_id IS NULL);
ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_removed_has_reason;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_removed_has_reason
  CHECK (status <> 'removed' OR (removed_at IS NOT NULL AND removed_reason IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_creator_posts_v2_ci ON creator_posts (campaign_influencer_id, status) WHERE v2;
CREATE INDEX IF NOT EXISTS idx_creator_posts_v2_offer ON creator_posts (offer_id) WHERE v2 AND offer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_posts_v2_mine ON creator_posts (influencer_id, updated_at DESC) WHERE v2;

/* 4 ── post_media: video */
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS mime text;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS size_bytes bigint;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS duration_s numeric(6,2);

/* 5 ── her collections (4.11) */
CREATE TABLE IF NOT EXISTS creator_collections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id  uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  kind           text NOT NULL CHECK (kind IN ('posts', 'products')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_creator_collections_mine ON creator_collections (influencer_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS creator_collection_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id           uuid NOT NULL REFERENCES creator_collections(id) ON DELETE CASCADE,
  post_id                 uuid REFERENCES creator_posts(id) ON DELETE CASCADE,
  product_id              uuid REFERENCES brand_products(id) ON DELETE CASCADE,
  campaign_influencer_id  uuid REFERENCES campaign_influencers(id) ON DELETE CASCADE,
  sort_order              integer NOT NULL DEFAULT 0,
  added_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cci_one_kind CHECK ((post_id IS NOT NULL) <> (product_id IS NOT NULL)),
  -- a product remembers the collaboration it came from: that decides its offer and her commission (M6)
  CONSTRAINT cci_product_has_collab CHECK (product_id IS NULL OR campaign_influencer_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cci_post ON creator_collection_items (collection_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cci_product ON creator_collection_items (collection_id, product_id, campaign_influencer_id) WHERE product_id IS NOT NULL;

COMMIT;
