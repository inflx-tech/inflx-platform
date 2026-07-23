-- 141_post_globals.sql — Post-pillar global elements (Post/Concept P3 globals)
-- Contract: features/concept-p3-post-globals/
--
-- Founder's global-elements session (2026-07-23):
--   · follower_app_config — ONE admin-editable settings object the follower
--     app fetches at launch. First keys: video_autoplay (true),
--     video_sound_default (false — founder pick). Every future global knob
--     lands here without an OTA.
--   · post_likes / post_saves — minimal engagement now (icons live from day
--     one); comments/share arrive in the intelligence phase.
--   · Attribution note (no schema): the 30-day attribution window is NOT
--     used for post purchases — every purchase starts inside a post that
--     carries its creator's tracking block. Direct attribution, no window.

BEGIN;

CREATE TABLE IF NOT EXISTS follower_app_config (
  id         smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),   -- single row
  config     jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO follower_app_config (id, config)
VALUES (1, '{"video_autoplay": true, "video_sound_default": false}')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS post_likes (
  post_id     uuid NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, follower_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_follower ON post_likes (follower_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_saves (
  post_id     uuid NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, follower_id)
);
CREATE INDEX IF NOT EXISTS idx_post_saves_follower ON post_saves (follower_id, created_at DESC);

COMMIT;
