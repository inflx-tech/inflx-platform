-- 106 — Per-creator posting window + date-change request/approve flow.
-- Forward-only + idempotent (IF NOT EXISTS everywhere). Purely additive:
-- the new campaign_influencers columns are nullable with no default, so
-- existing rows keep window_start/window_end = NULL and the effective window
-- falls back to the set-level campaign_sets.window_start/window_end (migration
-- 002). No destructive changes; safe to re-run.
--
-- Contract: features/campaign-command-center (Phase 3). Today dates are
-- set-level (campaign_sets.window_start/window_end) + per-creator
-- campaign_influencers.posting_date only. Phase 3 adds a per-creator window
-- the brand can grant via the date-change approval flow.

-- (a) Per-creator posting window — overrides the set window when set.
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS window_start date,
  ADD COLUMN IF NOT EXISTS window_end   date;

-- (b) Date-change requests — influencer asks to shift their posting window;
-- brand approves (which writes the per-creator window above) or rejects.
DO $$ BEGIN
  CREATE TYPE date_change_status AS ENUM ('requested', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS date_change_requests (
  id                     uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_influencer_id uuid               NOT NULL REFERENCES campaign_influencers(id) ON DELETE CASCADE,
  requested_start        date               NOT NULL,
  requested_end          date               NOT NULL,
  reason                 text,
  status                 date_change_status NOT NULL DEFAULT 'requested',
  created_at             timestamptz        NOT NULL DEFAULT now(),
  decided_at             timestamptz,
  decided_by             uuid               REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_date_change_requests_ci
  ON date_change_requests (campaign_influencer_id);
CREATE INDEX IF NOT EXISTS idx_date_change_requests_pending
  ON date_change_requests (campaign_influencer_id) WHERE status = 'requested';
