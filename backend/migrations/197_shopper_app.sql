-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 197 — the shopper app (follower-app-v2)
-- Contract: features/follower-app-v2 · rules v1.7 §4.7, §4.15, §5
--
--   1. followers                 — her Welcome choices (Women/Men/Kids, styles) and her city as the
--                                  fallback when location is off (5.3, 5.4). Exact coordinates the old
--                                  app stored are cleared: location is used, never stored.
--   2. follower_wishlist_items   — a saved product remembers the post (or collection item) it came
--                                  from, so buying it later credits that creator and applies that
--                                  post's offer (5.8, M1, M5, M6).
--   3. post_comments + reports   — text comments, up to 300 characters; report → admin queue (4.15).
--                                  author_kind/reply_to are there for the creator's replies (Level 5).
--   4. post_events               — the recording vocabulary widens to what the app records (5.14).
--   5. post_performance          — each live post's numbers across all shoppers, refreshed hourly;
--                                  read only by the learning feed (5.12 Stage B, off by default).
--   6. platform_settings         — the feed's numbers and the learning switch (5.12).
--
-- ADDITIVE except the location clear (none were held in production on 29 Sep).
-- MONEY: none moves. scripts/run-197.js reads it before and after.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

/* 1 ── followers: Welcome choices, city fallback, no stored location */
ALTER TABLE followers ADD COLUMN IF NOT EXISTS city_id integer REFERENCES ref_cities(id);
ALTER TABLE followers ADD COLUMN IF NOT EXISTS shop_for text[] NOT NULL DEFAULT '{}';
ALTER TABLE followers ADD COLUMN IF NOT EXISTS style_tag_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE followers ADD COLUMN IF NOT EXISTS welcomed_at timestamptz;
DO $$ BEGIN
  ALTER TABLE followers ADD CONSTRAINT followers_shop_for_known CHECK (shop_for <@ ARRAY['women', 'men', 'kids']::text[]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE followers SET last_lat = NULL, last_lng = NULL, area_name = NULL, location_updated_at = NULL
 WHERE last_lat IS NOT NULL OR last_lng IS NOT NULL OR area_name IS NOT NULL;

/* 2 ── a saved product remembers where it came from */
ALTER TABLE follower_wishlist_items ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES creator_posts(id) ON DELETE SET NULL;
ALTER TABLE follower_wishlist_items ADD COLUMN IF NOT EXISTS collection_item_id uuid REFERENCES creator_collection_items(id) ON DELETE SET NULL;

/* 3 ── comments and reports */
CREATE TABLE IF NOT EXISTS post_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         uuid NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
  author_kind     text NOT NULL DEFAULT 'follower' CHECK (author_kind IN ('follower', 'creator')),
  follower_id     uuid REFERENCES followers(id) ON DELETE CASCADE,
  influencer_id   uuid REFERENCES influencers(id) ON DELETE CASCADE,
  reply_to        uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  body            text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 300),
  status          text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'removed')),
  hidden_at       timestamptz,
  removed_at      timestamptz,
  removed_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_author CHECK (
    (author_kind = 'follower' AND follower_id IS NOT NULL) OR (author_kind = 'creator' AND influencer_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_comment_reports (
  comment_id   uuid NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  follower_id  uuid NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  decision     text CHECK (decision IN ('removed', 'kept')),
  decided_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (comment_id, follower_id)
);
CREATE INDEX IF NOT EXISTS idx_pcr_open ON post_comment_reports (created_at) WHERE decided_at IS NULL;

/* 4 ── what the app records (5.14) */
ALTER TABLE post_events DROP CONSTRAINT IF EXISTS post_events_event_type_check;
ALTER TABLE post_events ADD CONSTRAINT post_events_event_type_check CHECK (event_type IN (
  'impression', 'view', 'complete', 'tap_shop', 'tap_product', 'share', 'save', 'unsave', 'like', 'unlike', 'add_to_bag',
  'open', 'dwell', 'watch', 'pause', 'sound_on', 'sound_off', 'replay', 'buffer',
  'tap_creator', 'tap_brand', 'comment', 'save_product', 'unsave_product'));
ALTER TABLE post_events DROP CONSTRAINT IF EXISTS post_events_surface_check;
ALTER TABLE post_events ADD CONSTRAINT post_events_surface_check CHECK (surface IN (
  'discover', 'posts_tab', 'videos_tab', 'concept', 'creator_store', 'wishlist', 'search', 'share_link',
  'home', 'play', 'post', 'brand_store', 'offers', 'saved', 'collection', 'link'));
-- "has she seen it" — the never-repeat lookup, for guests and for accounts
CREATE INDEX IF NOT EXISTS idx_post_events_seen_device ON post_events (device_id, post_id, created_at DESC) WHERE event_type = 'impression';
CREATE INDEX IF NOT EXISTS idx_post_events_seen_follower ON post_events (follower_id, post_id, created_at DESC) WHERE event_type = 'impression' AND follower_id IS NOT NULL;

/* 5 ── each post's numbers across all shoppers (Stage B) */
CREATE TABLE IF NOT EXISTS post_performance (
  post_id       uuid PRIMARY KEY REFERENCES creator_posts(id) ON DELETE CASCADE,
  seen          integer NOT NULL DEFAULT 0,
  opens         integer NOT NULL DEFAULT 0,
  shop_taps     integer NOT NULL DEFAULT 0,
  saves         integer NOT NULL DEFAULT 0,
  likes         integer NOT NULL DEFAULT 0,
  completes     integer NOT NULL DEFAULT 0,
  score         numeric(10,6) NOT NULL DEFAULT 0,
  refreshed_at  timestamptz NOT NULL DEFAULT now()
);

/* 6 ── the feed's numbers (5.12) */
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
  ('feed_near_km',        50, 5, 500, 'km',      'Near range'),
  ('feed_new_share_pct',  15, 0, 50,  'percent', 'Places for new posts'),
  ('feed_new_hours',      48, 6, 168, 'hours',   'A post counts as new for'),
  ('feed_repeat_days',    30, 1, 90,  'days',    'Seen posts stay out of the feed for'),
  ('feed_learning_on',     0, 0, 1,   'on/off',  'Feed that learns'),
  ('feed_w_does',         40, 0, 100, 'weight',  'Dial: what she does'),
  ('feed_w_recent',       25, 0, 100, 'weight',  'Dial: how recent'),
  ('feed_w_near',         15, 0, 100, 'weight',  'Dial: how near'),
  ('feed_w_performs',     20, 0, 100, 'weight',  'Dial: how it performs')
ON CONFLICT (key) DO NOTHING;

COMMIT;
