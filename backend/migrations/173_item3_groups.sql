-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 173 — Item 3: the §5A rules on the existing creator-groups tables.
-- Contract: features/item3-discovery-profiles-groups · rules v1.11 §5A · gap report D6
--
-- influencer_groups / influencer_group_members (mig 123) already hold the brand website's
-- "Shortlist" feature (7 groups, 28 members in production). §5A adds: who added a member,
-- names unique per brand ignoring case, names 1–40 characters, and a member cap of 100
-- (enforced in the service — a CHECK cannot count rows). Every existing row passes the two
-- name rules (longest name today: 22 characters; no case-insensitive duplicates).
--
-- The name-length CHECK is added NOT VALID and validated in the same run, so the run stops
-- loudly if production ever disagrees with the dry run instead of half-applying.
--
-- Additive + idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE influencer_group_members ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES users(id) ON DELETE SET NULL;
COMMENT ON COLUMN influencer_group_members.added_by IS 'Item 3: the brand user who added the member.';

ALTER TABLE influencer_groups DROP CONSTRAINT IF EXISTS influencer_groups_name_len;
ALTER TABLE influencer_groups ADD CONSTRAINT influencer_groups_name_len
  CHECK (char_length(trim(name)) BETWEEN 1 AND 40) NOT VALID;
ALTER TABLE influencer_groups VALIDATE CONSTRAINT influencer_groups_name_len;

CREATE UNIQUE INDEX IF NOT EXISTS uq_influencer_groups_brand_lower_name
  ON influencer_groups (brand_id, lower(trim(name)));
CREATE INDEX IF NOT EXISTS idx_influencer_group_members_influencer ON influencer_group_members (influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_groups_brand_updated ON influencer_groups (brand_id, updated_at DESC);

COMMENT ON TABLE influencer_groups IS
  'Rules v1.11 §5A Creator Groups: private brand lists. Name 1–40, unique per brand (case-insensitive). ≤100 members (service-enforced). A selection shortcut only — never touches invitations, sets or contracts. Creators are never told.';

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM influencer_groups;         -- unchanged (7 today)
--   SELECT count(*) FROM influencer_group_members;  -- unchanged (28 today)
