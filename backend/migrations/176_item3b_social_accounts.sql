-- 176 — Item 3b: one social account row per creator per platform, with its state.
-- Contract: features/item3b-social-numbers · rules v1.12 §2A · prompt §3.1, §3.4
--
-- States: waiting_approval · waiting_check · rejected · measuring · ok · not_found · private · failing
-- ("not_added" = no current row). A handle change creates a NEW row and marks the old one
-- replaced (replaced_at), so the old handle's posts and snapshots are never reused.
--
-- Backfill (founder Q4): every existing handle gets a row. Approved creators start as
-- `measuring` with ownership confirmed (admin approved them with these handles); pending
-- creators as `waiting_approval`; rejected creators get no row. At the same moment the five
-- legacy number columns are NULLed — today's values came from a spreadsheet import or the
-- mock fixture, not from a measurement — so Discover shows "—" until the first real run.
-- Due dates are left NULL here; scripts/run-social-backfill.js spreads them over N days.

BEGIN;

CREATE TABLE IF NOT EXISTS creator_social_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id         uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  platform              text NOT NULL CHECK (platform IN ('instagram', 'youtube')),
  handle_raw            text,
  handle_norm           text NOT NULL,
  platform_account_id   text,
  channel_url           text,
  state                 text NOT NULL CHECK (state IN ('waiting_approval','waiting_check','rejected','measuring','ok','not_found','private','failing')),
  ownership             text NOT NULL DEFAULT 'pending' CHECK (ownership IN ('pending','confirmed','rejected')),
  ownership_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  ownership_at          timestamptz,
  last_profile_at       timestamptz,
  last_posts_at         timestamptz,
  profile_due_at        timestamptz,
  posts_due_at          timestamptz,
  retry_at              timestamptz,
  running_since         timestamptz,
  failure_count         int NOT NULL DEFAULT 0,
  last_error            text,
  last_check_again_at   timestamptz,
  replaced_at           timestamptz,
  replaced_by           uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_social_accounts_current
  ON creator_social_accounts (influencer_id, platform) WHERE replaced_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_creator_social_accounts_due
  ON creator_social_accounts (profile_due_at, posts_due_at, retry_at) WHERE replaced_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_creator_social_accounts_state
  ON creator_social_accounts (state) WHERE replaced_at IS NULL;

-- Backfill from the handles creators already have.
INSERT INTO creator_social_accounts (influencer_id, platform, handle_raw, handle_norm, state, ownership, ownership_at, created_at)
SELECT i.id, 'instagram', i.instagram_handle, lower(trim(i.instagram_handle)),
       CASE WHEN u.status = 'approved' OR u.status = 'suspended' THEN 'measuring' ELSE 'waiting_approval' END,
       CASE WHEN u.status IN ('approved','suspended') THEN 'confirmed' ELSE 'pending' END,
       CASE WHEN u.status IN ('approved','suspended') THEN COALESCE(i.approved_at, now()) END,
       COALESCE(i.created_at, now())
  FROM influencers i JOIN users u ON u.id = i.user_id
 WHERE i.instagram_handle IS NOT NULL AND trim(i.instagram_handle) <> '' AND u.status <> 'rejected'
ON CONFLICT DO NOTHING;

INSERT INTO creator_social_accounts (influencer_id, platform, handle_raw, handle_norm, state, ownership, ownership_at, created_at)
SELECT i.id, 'youtube', i.youtube_handle, lower(trim(i.youtube_handle)),
       CASE WHEN u.status = 'approved' OR u.status = 'suspended' THEN 'measuring' ELSE 'waiting_approval' END,
       CASE WHEN u.status IN ('approved','suspended') THEN 'confirmed' ELSE 'pending' END,
       CASE WHEN u.status IN ('approved','suspended') THEN COALESCE(i.approved_at, now()) END,
       COALESCE(i.created_at, now())
  FROM influencers i JOIN users u ON u.id = i.user_id
 WHERE i.youtube_handle IS NOT NULL AND trim(i.youtube_handle) <> '' AND u.status <> 'rejected'
ON CONFLICT DO NOTHING;

-- Founder Q4: hide today's unmeasured numbers until the first real run writes them back.
UPDATE influencers
   SET followers_count = NULL, engagement_rate = NULL, scrape_last_run = NULL,
       youtube_subscribers = NULL, youtube_scrape_last_run = NULL;

COMMIT;
