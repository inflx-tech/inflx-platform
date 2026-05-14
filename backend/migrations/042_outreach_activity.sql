-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 042 — outreach_activity
--
-- The activity log that drives the marketing-engine tracking workspace.
-- Every touch with a lead (influencer or brand) is one row here. The
-- creator_profiles.outreach_status / brand_profiles.outreach_status column
-- is just the latest derived state; this log is the source of truth.
--
-- One log row = one of:
--   - An outbound message you sent (DM, WhatsApp, email, call notes, etc.)
--   - An inbound reply from the lead
--   - An internal note you wrote to yourself
--
-- Status state machine (enforced in the application layer, not here):
--   not_contacted → contacted → replied → interested → negotiating → registered
--   (any state) → dead       (final, can't reverse without admin override)
--   (any state) → paused     (temporary, can resume to previous stage)
--
-- This is INTENTIONALLY DIFFERENT from creator_invitations (migration 030):
--   - creator_invitations = brand→creator under a campaign (campaign system)
--   - outreach_activity   = admin→lead, ad-hoc marketing engine (no campaign)
--
-- Idempotent: IF NOT EXISTS throughout. Indexed for the timeline query
-- (target_type, target_id, logged_at DESC) and for the "today's follow-ups"
-- inbox query (next_action_due where not yet acted).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS outreach_activity (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What lead does this activity belong to
  target_type              TEXT NOT NULL
                           CHECK (target_type IN ('influencer','brand')),
  target_id                UUID NOT NULL,
  ig_handle                TEXT,  -- denormalized for fast filtering

  -- Channel + direction
  channel                  TEXT NOT NULL
                           CHECK (channel IN ('dm','whatsapp','email','call',
                                              'in_person','sms','other','internal')),
  direction                TEXT NOT NULL
                           CHECK (direction IN ('outbound','inbound','internal_note')),

  -- Content of the touch
  message_body             TEXT,
  internal_notes           TEXT,
  sentiment                TEXT
                           CHECK (sentiment IS NULL
                               OR sentiment IN ('positive','neutral','negative')),

  -- Follow-up planning
  next_action              TEXT,
  next_action_due          TIMESTAMPTZ,
  next_action_done         BOOLEAN DEFAULT FALSE,
  next_action_done_at      TIMESTAMPTZ,

  -- Optional metadata (e.g. WhatsApp message ID, attachment URL, video URL)
  metadata                 JSONB DEFAULT '{}'::jsonb,

  -- If this activity caused a status transition, record what it became
  status_after             TEXT,

  -- Who logged this
  logged_by                UUID REFERENCES users(id) ON DELETE SET NULL,
  logged_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS outreach_activity_updated_at ON outreach_activity;
CREATE TRIGGER outreach_activity_updated_at
  BEFORE UPDATE ON outreach_activity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Timeline for one lead (newest first) — the detail-panel query
CREATE INDEX IF NOT EXISTS idx_outreach_activity_timeline
  ON outreach_activity (target_type, target_id, logged_at DESC);

-- By handle (when target_id isn't yet known, e.g. inbound webhook lookups)
CREATE INDEX IF NOT EXISTS idx_outreach_activity_handle
  ON outreach_activity (ig_handle, logged_at DESC)
  WHERE ig_handle IS NOT NULL;

-- Inbox / today's follow-ups (pending next-actions due today or earlier)
CREATE INDEX IF NOT EXISTS idx_outreach_activity_followups_due
  ON outreach_activity (next_action_due)
  WHERE next_action_done = FALSE AND next_action_due IS NOT NULL;

-- Inbound activity feed (the "new replies" page)
CREATE INDEX IF NOT EXISTS idx_outreach_activity_inbound
  ON outreach_activity (logged_at DESC)
  WHERE direction = 'inbound';

-- All activity by admin user (audit trail / activity-by-admin report)
CREATE INDEX IF NOT EXISTS idx_outreach_activity_by_admin
  ON outreach_activity (logged_by, logged_at DESC)
  WHERE logged_by IS NOT NULL;

COMMIT;
