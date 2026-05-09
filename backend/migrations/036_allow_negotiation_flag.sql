-- 036: Add allow_negotiation flag on campaigns.
-- When false, influencers can only Accept or Decline offers — no Negotiate.
-- Default true keeps existing behaviour for legacy campaigns.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS allow_negotiation BOOLEAN NOT NULL DEFAULT true;
