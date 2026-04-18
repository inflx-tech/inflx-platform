-- 018_commission_negotiation.sql
-- Lets influencers counter the commission % (not just the fee) for
-- conversion / hybrid campaigns, gated by an admin-controlled toggle.

BEGIN;

-- ── per-turn commission counter on the negotiation thread ───────────────────
ALTER TABLE negotiation_turns
  ADD COLUMN IF NOT EXISTS proposed_commission_pct NUMERIC(5,2);

-- ── admin platform toggle ───────────────────────────────────────────────────
ALTER TABLE payment_config
  ADD COLUMN IF NOT EXISTS allow_commission_negotiation BOOLEAN NOT NULL DEFAULT TRUE;

COMMIT;
