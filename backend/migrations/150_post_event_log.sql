-- 150_post_event_log.sql — follower behaviour log for posts (Slice 0)
-- Contract: features/follower-event-log/
--
-- The follower app has no memory. Today the only recorded behaviour is
-- post_likes / post_saves (mig 141): what was SHOWN, what was watched, what was
-- tapped, and which post caused a sale are all unrecorded. Three committed
-- features are unbuildable without this:
--   · per-post sales for own-store creators (dual-role rule, locked 2026-08-05)
--   · the 4-signal feed ranker (personal / recent / local / global)
--   · every creator/brand/admin stats surface
--
-- Two things ship here and NOTHING reads either one yet:
--   1. post_events — append-only behaviour log. Guests included: follower_id is
--      NULL and device_id carries the identity (follower-guest-first law).
--   2. follower_transactions.via_post_id — the missing post→sale link. Same
--      additive, nullable, dormant-column pattern as via_store_influencer_id
--      (mig 094) and product_id (mig 046).
--
-- Deliberately NOT here: rollup/aggregate tables. Raw + indexes is correct at
-- zero volume; rollups get added when real traffic proves they are needed.

BEGIN;

CREATE TABLE IF NOT EXISTS post_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
  -- NULL for guests — browsing without an account is the norm, not an edge case
  follower_id uuid REFERENCES followers(id) ON DELETE CASCADE,
  device_id   text NOT NULL,
  session_id  text,
  event_type  text NOT NULL CHECK (event_type IN (
                'impression','view','complete','tap_shop','tap_product',
                'share','save','unsave','like','unlike','add_to_bag')),
  surface     text NOT NULL CHECK (surface IN (
                'discover','posts_tab','videos_tab','concept','creator_store',
                'wishlist','search','share_link')),
  position    integer,                                    -- feed rank when shown
  product_id  uuid REFERENCES brand_products(id) ON DELETE SET NULL,
  dwell_ms    integer CHECK (dwell_ms IS NULL OR dwell_ms >= 0),
  meta        jsonb NOT NULL DEFAULT '{}',                -- forward room; never load-bearing
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- "how did THIS post perform" — the global-signal + stats workload
CREATE INDEX IF NOT EXISTS idx_post_events_post
  ON post_events (post_id, event_type, created_at DESC);
-- "what has THIS follower done" — the personal-signal workload
CREATE INDEX IF NOT EXISTS idx_post_events_follower
  ON post_events (follower_id, created_at DESC) WHERE follower_id IS NOT NULL;
-- same, for guests
CREATE INDEX IF NOT EXISTS idx_post_events_device
  ON post_events (device_id, created_at DESC);
-- recency sweeps / future purge
CREATE INDEX IF NOT EXISTS idx_post_events_created
  ON post_events (created_at DESC);

-- ── the missing post → sale link ────────────────────────────────────────────
-- Dormant until the order path threads it. NULL on every existing row, so no
-- read path changes. SET NULL on post delete: the money row must survive its
-- post being removed.
ALTER TABLE follower_transactions
  ADD COLUMN IF NOT EXISTS via_post_id uuid REFERENCES creator_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ft_via_post
  ON follower_transactions (via_post_id, created_at DESC) WHERE via_post_id IS NOT NULL;

COMMIT;
