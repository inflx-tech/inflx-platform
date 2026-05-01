-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 025 — Influencer Proposals (Phase Q)
--
-- Reverses the marketplace direction: today brands invite influencers; after
-- this, influencers can pitch brands. Strict guardrails to prevent spam:
--
--   1. brands.accepts_proposals — opt-in, off by default. Brand must
--      actively turn it on.
--   2. brands.proposal_filters — JSONB constraints (tier / niche / city /
--      engagement / past-collab). Influencers below the bar can't pitch.
--   3. proposal_cooldowns — when brand rejects, that influencer can't
--      repitch the same brand for 30 days.
--   4. influencers.proposal_status — admin can suspend abusive influencers.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Brand-side opt-in
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS accepts_proposals BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS proposal_filters  JSONB   NOT NULL DEFAULT '{}'::jsonb;
-- Example proposal_filters payload:
-- {
--   "min_tier": "micro",                  -- nano | micro | macro | mega (or null = any)
--   "allowed_niches": ["food", "lifestyle"],
--   "city_match_required": true,          -- influencer.city must match brand.city
--   "min_engagement_rate": 2.0,
--   "only_past_collabs": false
-- }

-- Influencer-side abuse status
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS proposal_status        TEXT NOT NULL DEFAULT 'eligible';
  -- eligible | suspended | banned
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS proposal_banned_until  TIMESTAMPTZ;

-- The proposal record
CREATE TABLE IF NOT EXISTS influencer_proposals (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id                     UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  brand_id                          UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  pitch_title                       TEXT NOT NULL,
  pitch_message                     TEXT NOT NULL,
  goal                              TEXT,           -- engagement | conversion | hybrid
  proposed_fee                      NUMERIC(10,2),
  proposed_commission_pct           NUMERIC(5,2),
  proposed_deliverables             JSONB,          -- [{type:'reel',count:2}, ...]
  proposed_posting_window_start     DATE,
  proposed_posting_window_end       DATE,
  portfolio_links                   TEXT[] DEFAULT '{}',  -- 1-3 sample post URLs
  status                            TEXT NOT NULL DEFAULT 'sent',
  -- sent | viewed | accepted | rejected | countered | expired | withdrawn
  brand_response_at                 TIMESTAMPTZ,
  brand_response_message            TEXT,
  counter_terms                     JSONB,          -- if status='countered'
  expires_at                        TIMESTAMPTZ NOT NULL,
  viewed_at                         TIMESTAMPTZ,
  resulting_campaign_influencer_id  UUID REFERENCES campaign_influencers(id) ON DELETE SET NULL,
  flagged                           BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason                       TEXT,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_influencer_proposals_brand
  ON influencer_proposals(brand_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_proposals_influencer
  ON influencer_proposals(influencer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_proposals_active
  ON influencer_proposals(status) WHERE status IN ('sent', 'viewed', 'countered');

-- Per-pair cooldown — when brand rejects, no new proposals for 30 days.
CREATE TABLE IF NOT EXISTS proposal_cooldowns (
  influencer_id        UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  brand_id             UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  cooldown_until       TIMESTAMPTZ NOT NULL,
  reason               TEXT,
  PRIMARY KEY (influencer_id, brand_id)
);

COMMIT;
