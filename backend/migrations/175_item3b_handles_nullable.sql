-- 175 — Item 3b: a creator needs at least ONE social account, Instagram OR YouTube.
-- Contract: features/item3b-social-numbers · rules v1.12 §2A · founder Q3
--
-- Before: influencers.instagram_handle was NOT NULL (001_initial_schema.sql:153) and the
-- marketing table creator_profiles.ig_handle was NOT NULL (the claim flow keys on it).
-- After: both nullable, unique indexes kept, and a check that at least one handle is set.
-- Additive: no data changes. All 25 production creators have an Instagram handle.

BEGIN;

ALTER TABLE influencers ALTER COLUMN instagram_handle DROP NOT NULL;
ALTER TABLE influencers
  ADD CONSTRAINT influencers_at_least_one_handle
  CHECK (instagram_handle IS NOT NULL OR youtube_handle IS NOT NULL) NOT VALID;
ALTER TABLE influencers VALIDATE CONSTRAINT influencers_at_least_one_handle;

-- creator_profiles: a YouTube-only sign-up still needs its minimal 'claimed' row so the
-- admin approval queue (which lists creator_profiles) can approve her (founder §3).
ALTER TABLE creator_profiles ALTER COLUMN ig_handle DROP NOT NULL;
ALTER TABLE creator_profiles
  ADD CONSTRAINT creator_profiles_at_least_one_handle
  CHECK (ig_handle IS NOT NULL OR youtube_handle IS NOT NULL) NOT VALID;
ALTER TABLE creator_profiles VALIDATE CONSTRAINT creator_profiles_at_least_one_handle;

COMMIT;
