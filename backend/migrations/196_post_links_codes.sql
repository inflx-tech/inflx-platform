-- 196_post_links_codes.sql
-- Contract: features/post-links-codes · Docs/OFFER_TERMS_POSTS_RULES.md §4.14 (v1.5)
--
-- Level 4 of the offer -> terms -> posts programme: post codes and links, store links, collection links,
-- and the visits they bring.
--
-- Parts:
--   1. creator_posts.post_code      — 6 characters, given when INFLX approves, never changes (unique);
--   2. creator_collections.link_code — the collection's one link, given when it is made (unique);
--   3. store_handles                — every handle a creator has had, so an old store link still opens
--                                     her store; kept by a trigger on influencers;
--   4. link_visits                  — one row per tap on her links (post / store / collection / typed
--                                     code), with the channel; no IP, no identity;
--   5. follower_transactions.link_channel — the channel an order through a post counts under
--                                     (NULL = "In INFLX"); written by checkout with the shopper app;
--   6. platform_settings            — link_channel_window_days (30, 1–90).
--
-- ADDITIVE. Codes are given to any post already approved and any collection already made.
-- MONEY: none moves. scripts/run-196.js reads it before and after.

BEGIN;

/* 1 ── post codes */
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS post_code text;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS code_issued_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_posts_code ON creator_posts (post_code) WHERE post_code IS NOT NULL;
ALTER TABLE creator_posts DROP CONSTRAINT IF EXISTS creator_posts_code_shape;
ALTER TABLE creator_posts ADD CONSTRAINT creator_posts_code_shape
  CHECK (post_code IS NULL OR post_code ~ '^[BCDFGHJKMNPQRSTVWXYZ2-9]{6}$');

/* 2 ── collection links */
ALTER TABLE creator_collections ADD COLUMN IF NOT EXISTS link_code text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_collections_code ON creator_collections (link_code) WHERE link_code IS NOT NULL;
ALTER TABLE creator_collections DROP CONSTRAINT IF EXISTS creator_collections_code_shape;
ALTER TABLE creator_collections ADD CONSTRAINT creator_collections_code_shape
  CHECK (link_code IS NULL OR link_code ~ '^[BCDFGHJKMNPQRSTVWXYZ2-9]{6}$');

-- A code nobody has, drawn from the 28-character alphabet (no vowels, no 0/O, 1/I or L).
CREATE OR REPLACE FUNCTION inflx_new_code(kind text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alphabet constant text := 'BCDFGHJKMNPQRSTVWXYZ23456789';
  code text;
  taken boolean;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    IF kind = 'post' THEN
      SELECT EXISTS (SELECT 1 FROM creator_posts WHERE post_code = code) INTO taken;
    ELSE
      SELECT EXISTS (SELECT 1 FROM creator_collections WHERE link_code = code) INTO taken;
    END IF;
    IF NOT taken THEN RETURN code; END IF;
  END LOOP;
END $$;

-- Posts already approved (or approved then removed) and collections already made get theirs now.
UPDATE creator_posts SET post_code = inflx_new_code('post'), code_issued_at = COALESCE(approved_at, now())
 WHERE v2 AND post_code IS NULL AND approved_at IS NOT NULL;
UPDATE creator_collections SET link_code = inflx_new_code('collection') WHERE link_code IS NULL;

/* 3 ── every handle she has had */
CREATE TABLE IF NOT EXISTS store_handles (
  handle         text PRIMARY KEY,               -- lower case, no '@'
  influencer_id  uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  first_seen_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_handles_influencer ON store_handles (influencer_id);

CREATE OR REPLACE FUNCTION inflx_keep_store_handle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE h text;
BEGIN
  h := lower(regexp_replace(COALESCE(NEW.instagram_handle, ''), '^@', ''));
  IF h <> '' THEN
    -- A handle stays with the first creator who had it; a later claim by someone else does not move it.
    INSERT INTO store_handles (handle, influencer_id) VALUES (h, NEW.id) ON CONFLICT (handle) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_keep_store_handle ON influencers;
CREATE TRIGGER trg_keep_store_handle AFTER INSERT OR UPDATE OF instagram_handle ON influencers
  FOR EACH ROW EXECUTE FUNCTION inflx_keep_store_handle();

INSERT INTO store_handles (handle, influencer_id)
SELECT lower(regexp_replace(instagram_handle, '^@', '')), id FROM influencers
 WHERE COALESCE(instagram_handle, '') <> ''
ON CONFLICT (handle) DO NOTHING;

/* 4 ── visits */
CREATE TABLE IF NOT EXISTS link_visits (
  id              bigserial PRIMARY KEY,
  kind            text NOT NULL CHECK (kind IN ('post', 'store', 'collection')),
  channel         text NOT NULL CHECK (channel IN ('ig', 'yt', 'wa', 'fb', 'o', 'code')),
  influencer_id   uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  post_id         uuid REFERENCES creator_posts(id) ON DELETE SET NULL,
  collection_id   uuid REFERENCES creator_collections(id) ON DELETE SET NULL,
  handle_used     text,                           -- the handle in a store link as typed (may be an old one)
  real_source     text,                           -- admin only: the referring site when it differs from the ending
  device_id       text,                           -- the shopper app's own id when a tap comes from it; web taps have none
  counts_until    timestamptz NOT NULL,           -- the order-channel window, fixed when the tap is made
  visited_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_link_visits_post ON link_visits (post_id, channel) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_link_visits_creator ON link_visits (influencer_id, kind, visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_visits_collection ON link_visits (collection_id) WHERE collection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_link_visits_device ON link_visits (device_id, influencer_id, visited_at DESC) WHERE device_id IS NOT NULL;

/* 5 ── the channel an order counts under (reporting only) */
ALTER TABLE follower_transactions ADD COLUMN IF NOT EXISTS link_channel text;
ALTER TABLE follower_transactions DROP CONSTRAINT IF EXISTS ft_link_channel_known;
ALTER TABLE follower_transactions ADD CONSTRAINT ft_link_channel_known
  CHECK (link_channel IS NULL OR link_channel IN ('ig', 'yt', 'wa', 'fb', 'o', 'code'));

/* 6 ── the window, set by INFLX */
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
  ('link_channel_window_days', 30, 1, 90, 'days', 'Link channel window')
ON CONFLICT (key) DO NOTHING;

COMMIT;
