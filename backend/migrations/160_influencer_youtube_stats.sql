-- 160 — YouTube reach for creators
--
-- A creator hands us a YouTube channel at signup (InfluencerRegisterScreen asks
-- for it, influencers.youtube_handle stores it) and nothing has ever read it back.
-- An admin reviewing a YouTube-first creator sees "0 followers, 0.00% engagement" —
-- the Instagram numbers — and has no way to tell that is a missing measurement
-- rather than a small creator.
--
-- These columns hold the YouTube side of the same question followers_count answers
-- for Instagram. They are deliberately separate columns, not a merged "reach":
-- 180k Instagram followers and 180k YouTube subscribers are not the same audience
-- and must never be added together.
--
-- Contract: features/admin-creator-review-completeness

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS youtube_channel_id        text,
  ADD COLUMN IF NOT EXISTS youtube_title             text,
  ADD COLUMN IF NOT EXISTS youtube_subscribers       bigint,
  ADD COLUMN IF NOT EXISTS youtube_views             bigint,
  ADD COLUMN IF NOT EXISTS youtube_videos            integer,
  ADD COLUMN IF NOT EXISTS youtube_thumbnail_url     text,
  ADD COLUMN IF NOT EXISTS youtube_scrape_data       jsonb,
  ADD COLUMN IF NOT EXISTS youtube_scrape_last_run   timestamptz;

COMMENT ON COLUMN influencers.youtube_channel_id IS
  'YouTube UC… channel id resolved from youtube_handle. Stable across handle changes.';
COMMENT ON COLUMN influencers.youtube_subscribers IS
  'Subscriber count read from the channel via Apify — same scraper as the Instagram side. NULL means never checked, or checked and unreadable. Never zero by default.';
COMMENT ON COLUMN influencers.youtube_scrape_last_run IS
  'When the YouTube figures were last fetched. NULL means the channel has never been checked; the admin screen says so rather than showing a confident 0.';
