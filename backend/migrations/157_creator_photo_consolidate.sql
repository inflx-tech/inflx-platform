-- 157_creator_photo_consolidate.sql
-- Contract: features/creator-photo-and-reach
--
-- ADD ONLY. The matching DROP is migration 158 and must not run until the new code is
-- live — see the ordering note below, which is the whole reason these are two files.
--
-- Background: migration 156 (yesterday) added influencers.avatar_url for "the picture the
-- creator uploads herself". That column was redundant the moment it was created —
-- influencers ALREADY had profile_image_url, described in influencer.controller
-- .getPublicById as exactly that: "onboarded influencers upload their own image". Two
-- columns for one fact is how a screen ends up reading the empty one forever.
--
-- Verified on production before writing this: 22 influencers, profile_image_url populated
-- on 0, avatar_url populated on 0. Neither carries data, so consolidating loses nothing.
--
-- ORDERING — why the drop is a separate migration:
--   The running backend selects i2.avatar_url in creator search. The new backend selects
--   i2.profile_image_r2_key. Whichever column is missing at the moment a request lands,
--   creator search breaks for the brand using it. Dropping and adding in one step
--   therefore guarantees an outage in one direction or the other:
--     · drop first  -> old code breaks until Render finishes deploying
--     · deploy first -> new code breaks until the migration runs
--   So: add here, deploy, verify, then drop in 158. Both columns exist in between and
--   both versions of the code work. No window where creator search is down.

-- Where the uploaded object actually lives. The URL a client receives is presigned at
-- read time from this key and expires — storing a presigned URL would hand every creator
-- a photo that stops loading a few hours later.
--
-- Mirrors the existing scraped-picture pair (profile_pic_url + profile_pic_r2_key on
-- creator_profiles, resolved by utils/avatarResolver) deliberately, so there is one way
-- to hold a picture on this platform rather than two competing ones.
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS profile_image_r2_key text;

COMMENT ON COLUMN influencers.profile_image_r2_key IS
  'R2 object key for the photo the creator uploaded in her own profile. Scraped Instagram pictures are never written here — founder instruction 2026-08-22.';
