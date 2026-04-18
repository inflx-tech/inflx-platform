-- 017_observability_and_sla.sql
-- Adds tracking columns so silent failures stop being silent, plus a
-- negotiation SLA so stale rounds don't block campaigns forever.

BEGIN;

-- ── contracts: track PDF generation outcome ─────────────────────────────────
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS pdf_generation_error    TEXT,
  ADD COLUMN IF NOT EXISTS pdf_generated_at        TIMESTAMPTZ;

-- ── campaign_influencers: track contract auto-create outcome ────────────────
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS contract_create_error      TEXT,
  ADD COLUMN IF NOT EXISTS contract_create_attempt_at TIMESTAMPTZ;

-- ── negotiations: SLA / expiry  (default 48h) ───────────────────────────────
ALTER TABLE negotiations
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- For any open negotiation row that has no expires_at, set 48h from created_at.
UPDATE negotiations
SET    expires_at = created_at + interval '48 hours'
WHERE  expires_at IS NULL
  AND  status IN ('awaiting_brand', 'awaiting_influencer');

CREATE INDEX IF NOT EXISTS idx_negotiations_expires_at
  ON negotiations (expires_at)
  WHERE status IN ('awaiting_brand', 'awaiting_influencer');

CREATE INDEX IF NOT EXISTS idx_negotiations_status_brand
  ON negotiations (status)
  WHERE status = 'awaiting_brand';

CREATE INDEX IF NOT EXISTS idx_deliverables_status_submitted
  ON deliverables (status, submitted_at)
  WHERE status IN ('submitted', 'under_review');

COMMIT;
