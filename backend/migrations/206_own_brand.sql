-- 206 — a creator who owns a brand (item 20).
-- Contract: features/item20-own-brand · 05-impact.md · rules v1.33 §2D
--
--   1. creator_brand_links   a creator's account linked to the brand he runs. One live link per
--                            creator; a brand may have several (in-house staff). Ids, never phone
--                            numbers: changing either login number later does not break the link.
--   2. brand_link_codes      the code sent to the brand's number to prove the link. Kept APART from
--                            otp_codes on purpose: a code in this table can never sign anyone in,
--                            and sending one never cancels a sign-in code in flight.
--   3. creator_posts.own_brand  a new post is for a collaboration OR for his linked brand, never
--                            both. The old rule ("a new post always has a collaboration") is
--                            loosened to say exactly that.
--   4. order_lines.campaign_influencer_id may be empty — only for a sale through an own-brand post.
--   5. post_share_places     where he shared an own-brand post (place + link). Nobody approves it.
--
-- ADDITIVE and idempotent. No existing row is written: every existing post has a collaboration and
-- own_brand = false, every existing order line has its collaboration.

BEGIN;

/* 1 ── the link */
CREATE TABLE IF NOT EXISTS creator_brand_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id  uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  brand_id       uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  linked_via     text NOT NULL CHECK (linked_via IN ('same_number', 'code')),
  linked_at      timestamptz NOT NULL DEFAULT now(),
  removed_at     timestamptz,
  removed_by     text CHECK (removed_by IS NULL OR removed_by IN ('creator', 'brand')),
  CONSTRAINT creator_brand_links_removed_whole CHECK ((removed_at IS NULL) = (removed_by IS NULL))
);
-- one brand per creator (O8); many creators per brand (O9)
CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_brand_links_live ON creator_brand_links (influencer_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_creator_brand_links_brand ON creator_brand_links (brand_id) WHERE removed_at IS NULL;

/* 2 ── the code that proves it */
CREATE TABLE IF NOT EXISTS brand_link_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id  uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  brand_id       uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  phone          varchar(15) NOT NULL,
  code           varchar(6) NOT NULL,
  wrong          integer NOT NULL DEFAULT 0,
  used           boolean NOT NULL DEFAULT false,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_link_codes_creator ON brand_link_codes (influencer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_link_codes_phone ON brand_link_codes (phone, created_at DESC);

/* 3 ── a post for his own brand */
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS own_brand boolean NOT NULL DEFAULT false;

ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_v2_shape;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_v2_shape
  CHECK (NOT v2 OR (((campaign_influencer_id IS NOT NULL) <> own_brand) AND brand_id IS NOT NULL
                    AND concept_id IS NULL AND collection_id IS NULL));
ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_own_brand_is_v2;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_own_brand_is_v2 CHECK (NOT own_brand OR v2);

CREATE INDEX IF NOT EXISTS idx_creator_posts_own_brand ON creator_posts (brand_id, status) WHERE own_brand;

/* 4 ── a sale through it has no collaboration */
ALTER TABLE order_lines ALTER COLUMN campaign_influencer_id DROP NOT NULL;

/* 5 ── where he shared it */
CREATE TABLE IF NOT EXISTS post_share_places (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
  place       text NOT NULL CHECK (place IN ('reel', 'post', 'story', 'youtube_video', 'youtube_short', 'facebook_post')),
  link        text CHECK (link IS NULL OR char_length(link) <= 500),
  shared_on   date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- a story is gone in a day and has no lasting link (D2); every other place has one
  CONSTRAINT post_share_places_link_unless_story CHECK (place = 'story' OR link IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_post_share_places_post ON post_share_places (post_id, shared_on, created_at);

COMMIT;
