-- 140_creator_posts.sql — Creator posts (Post/Concept program P2)
-- Contract: features/concept-p2-posts/ · Architecture: POST_CONCEPT_MODEL.md §5-§7
--
-- THE source-of-truth entity of the new follower app: a creator's shoppable
-- post. NOT the scraped-Instagram `posts` table (mig 025) — that name was
-- taken, hence creator_posts.
--
-- Model locks this encodes (founder, 2026-07-22):
--   · one post = ONE concept XOR ONE collection, permanently (CHECK + no
--     update path exposed) — want other photos elsewhere? publish again.
--   · concept identity = lazily-materialized concepts(template × leaf?) row.
--   · image tags are COORDINATES ONLY (x/y % per slide) — nothing is drawn
--     into the image; labels render at runtime from live product data, so a
--     price change never needs a republish.
--   · "live/dark" is NOT a stored status: visibility = approved AND the live
--     eligibility test (≥1 attached product still satisfies the concept — P4
--     builds the resolver). Stored status is only the moderation lifecycle.
--   · media_kind='video' is reserved (P6); this phase ships images only.
--
-- Ships EMPTY. No follower surface reads posts until P3/P4.

BEGIN;

CREATE TABLE IF NOT EXISTS creator_posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id    uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  -- step-1 scope: which collaborations feed the product universe
  scope            text NOT NULL CHECK (scope IN ('single','multi','all')),
  scoped_brand_ids uuid[] NOT NULL DEFAULT '{}',
  -- step-2: concept XOR collection (family 6)
  concept_id       uuid REFERENCES concepts(id)    ON DELETE RESTRICT,
  collection_id    uuid REFERENCES collections(id) ON DELETE RESTRICT,
  post_type        text NOT NULL DEFAULT 'lifestyle'
                     CHECK (post_type IN ('lifestyle','editorial')),
  media_kind       text NOT NULL DEFAULT 'image' CHECK (media_kind IN ('image','video')),
  tag_style        text NOT NULL DEFAULT 'soft_editorial'
                     CHECK (tag_style IN ('soft_editorial','minimal','hidden')),
  caption          text,
  status           text NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('draft','submitted','approved','rejected')),
  reject_reason    text,
  approved_by      uuid,          -- admin users.id
  approved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((concept_id IS NOT NULL) <> (collection_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_creator_posts_influencer
  ON creator_posts (influencer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_posts_status
  ON creator_posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_posts_concept
  ON creator_posts (concept_id) WHERE concept_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_posts_collection
  ON creator_posts (collection_id) WHERE collection_id IS NOT NULL;

-- Ordered slides. r2_key under posts/<influencer_id>/…; served via the public
-- redirect route /v1/media/post/:id (fresh presign per request, same pattern
-- as /v1/media/assets/:id).
CREATE TABLE IF NOT EXISTS post_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
  slide_index integer NOT NULL DEFAULT 0,
  r2_key      text NOT NULL,
  width       integer,
  height      integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, slide_index)
);

-- Product tags. x/y are percentages (0-100) of the rendered image — device-
-- independent; NULL for video posts (P6: list-only, no coordinates).
CREATE TABLE IF NOT EXISTS post_products (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
  media_id   uuid REFERENCES post_media(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES brand_products(id) ON DELETE CASCADE,
  x_pct      numeric(5,2) CHECK (x_pct IS NULL OR (x_pct >= 0 AND x_pct <= 100)),
  y_pct      numeric(5,2) CHECK (y_pct IS NULL OR (y_pct >= 0 AND y_pct <= 100)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_products_post ON post_products (post_id);
CREATE INDEX IF NOT EXISTS idx_post_products_product ON post_products (product_id);

COMMIT;
