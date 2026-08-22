-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 156 — the picture a creator uploaded herself
-- Contract: features/stage-1-find-each-other-and-agree
--
-- FOUNDER'S DECISION, 2026-08-22:
--   "Don't add scraped one as pic. Let creator upload it in profile, then only that
--    particular pic should come."
--
-- WHY A NEW COLUMN RATHER THAN REUSING THE OLD ONE
-- influencers.profile_image_url IS the scraped Instagram picture — it is written by the
-- Apify scrape at registration and refreshed from it, and there is a whole caching path
-- (profile_pic_r2_key, avatarResolver) built around the fact that Instagram's CDN URLs
-- expire in a week or two. It cannot double as "what she chose to show us" without the
-- next scrape silently overwriting her choice.
--
-- So: avatar_url means SHE UPLOADED THIS, and nothing else ever writes it. A creator with
-- no upload has no picture, and every screen falls back to her initials — which is the
-- honest state, not a placeholder standing in for one.
--
-- Consequence, stated plainly: after this, NOBODY has a picture until they upload one.
-- That is the intended behaviour, not a regression.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN influencers.avatar_url IS
  'The picture the CREATOR uploaded herself, and the only one any surface may display. '
  'Written solely by her own profile update. Distinct from profile_image_url, which is '
  'the scraped Instagram picture and is never shown to brands (migration 156, '
  'founder decision 2026-08-22).';
