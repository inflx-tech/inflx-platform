-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 030 — creator_invitations
--
-- Brand-driven outreach queue. When a brand wants to add an UNCLAIMED
-- (not-yet-on-Inflx) creator to a campaign, an invitation row is created
-- here. Admin sees the queue, runs cold outreach (SMS/HeyGen/etc), and
-- when the creator finally signs up the invite auto-converts into a
-- real campaign_influencers row.
--
-- Status flow:
--   pending     → just created by brand
--   contacted   → admin has run outreach
--   converted   → creator signed up + claimed → campaign_influencers row created
--   declined    → creator signed up but rejected the brand
--   expired     → too much time passed, no signup
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS creator_invitations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  creator_profile_id    UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  brand_id              UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,

  -- optional context — brand may invite outside any campaign
  campaign_id           UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  set_id                UUID REFERENCES campaign_sets(id) ON DELETE SET NULL,

  brand_message         TEXT,                          -- optional pitch from brand
  proposed_fee          NUMERIC(10,2),                 -- optional rupees

  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','contacted','converted','declined','expired')),

  invited_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at          TIMESTAMPTZ,
  converted_at          TIMESTAMPTZ,
  declined_at           TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  contacted_by          UUID REFERENCES users(id) ON DELETE SET NULL,    -- admin who ran outreach
  converted_to_ci_id    UUID REFERENCES campaign_influencers(id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One pending invitation per (brand, creator, campaign) tuple to avoid spam
  UNIQUE (brand_id, creator_profile_id, campaign_id)
);

DROP TRIGGER IF EXISTS creator_invitations_updated_at ON creator_invitations;
CREATE TRIGGER creator_invitations_updated_at
  BEFORE UPDATE ON creator_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Admin queue
CREATE INDEX IF NOT EXISTS idx_creator_invitations_admin_queue
  ON creator_invitations (status, invited_at)
  WHERE status IN ('pending', 'contacted');

-- Look up invitations by creator (for auto-conversion on signup)
CREATE INDEX IF NOT EXISTS idx_creator_invitations_by_creator
  ON creator_invitations (creator_profile_id, status);

-- Brand's own invitations list
CREATE INDEX IF NOT EXISTS idx_creator_invitations_by_brand
  ON creator_invitations (brand_id, invited_at DESC);

COMMIT;
