-- 180 — Item 4: campaigns and sets, the columns the rules need.
-- Contract: features/item4-campaigns-sets · rules v1.14 §5B · gap report §6 (approved as proposed)
--
-- Additive only. No backfill: the nine production sets predate the date model and read
-- as drafts that need a date, which is honest (founder, APPROVAL.md §3.6).
BEGIN;

-- Campaign: "most recently updated first" needs a clock, and G10 needs somewhere to remember
-- the creator group a campaign was started from (never shown to creators).
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_from_group_id uuid REFERENCES influencer_groups(id) ON DELETE SET NULL;

-- Set: the branch a Store Visit set names, timestamps, and the moment it expired. Expiry is
-- an EVENT the hourly job performs (open invitations are closed at the same time), so it is
-- recorded rather than recomputed; draft and live are derived from the invitations.
ALTER TABLE campaign_sets
  ADD COLUMN IF NOT EXISTS branch_id  uuid REFERENCES brand_branches(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- A Store Visit set must name a branch. NOT VALID then VALIDATE so the nine existing rows
-- (all with a null mode) are checked without locking the table against writes.
DO $$ BEGIN
  ALTER TABLE campaign_sets
    ADD CONSTRAINT campaign_sets_visit_needs_branch
    CHECK (branch_id IS NOT NULL OR shoot_mode IS DISTINCT FROM 'visit') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE campaign_sets VALIDATE CONSTRAINT campaign_sets_visit_needs_branch;

-- updated_at triggers, the same shape the rest of the schema uses.
CREATE OR REPLACE FUNCTION set_updated_at_now() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaigns_updated_at ON campaigns;
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();
DROP TRIGGER IF EXISTS campaign_sets_updated_at ON campaign_sets;
CREATE TRIGGER campaign_sets_updated_at BEFORE UPDATE ON campaign_sets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();

-- The table had no index at all. campaign_id is the only way a set is ever looked up.
CREATE INDEX IF NOT EXISTS idx_campaign_sets_campaign ON campaign_sets (campaign_id);
-- The expiry job's scan: sets with a date that have not expired.
CREATE INDEX IF NOT EXISTS idx_campaign_sets_due ON campaign_sets (go_live_date) WHERE expired_at IS NULL AND go_live_date IS NOT NULL;
-- The counts query groups invitations by set and status.
CREATE INDEX IF NOT EXISTS idx_ci_set_status ON campaign_influencers (set_id, status);

COMMENT ON COLUMN campaigns.started_from_group_id IS 'Item 4 / G10: the creator group this campaign was started from. Seeds the first set''s picker (item 5). Never shown to creators.';
COMMENT ON COLUMN campaign_sets.branch_id IS 'Item 4: the branch a Store Visit set names. Creators see its city; the address travels with the shoot plan.';
COMMENT ON COLUMN campaign_sets.expired_at IS 'Item 4: set by the set-expiry job when the cutoff passed with no agreement signed by both sides. Null = not expired.';

COMMIT;
