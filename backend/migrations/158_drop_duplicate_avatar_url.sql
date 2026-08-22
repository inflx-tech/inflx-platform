-- 158_drop_duplicate_avatar_url.sql
-- Contract: features/creator-photo-and-reach
--
-- DESTRUCTIVE. Run this ONLY after the backend that stopped reading avatar_url is live
-- and creator search has been confirmed working against production. Running it early
-- breaks creator search for every brand until Render finishes deploying. See 157 for the
-- full ordering argument.
--
-- What is being dropped: influencers.avatar_url, added by migration 156 the previous day.
-- It duplicated profile_image_url, which already existed for exactly this purpose.
--
-- Safety, verified on production immediately before this was written:
--   SELECT count(*) total, count(avatar_url) populated FROM influencers;
--   -> total 22, populated 0
-- The column has never held a value. Nothing is lost, and recreating it is one statement
-- if that judgement is ever wrong.

ALTER TABLE influencers DROP COLUMN IF EXISTS avatar_url;
