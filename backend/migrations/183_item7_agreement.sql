-- 183_item7_agreement.sql
-- Item 7 — the agreement and the two signatures.
-- Rules doc v1.20 §9 (with §3, §10, §21, §25, §28). Contract: features/item7-agreement.
--
-- Additive only. No column is dropped, no value is rewritten, no signature is
-- ever invented. The four seeded contracts stay exactly as they are.
--
-- Three parts:
--   A. the money-safety index that Phase 2a needs (approval Q4)
--   B. the agreement itself — the snapshot, the reference, the signatures
--   C. the standard terms, versioned, seeded at 1.0 with today's wording

BEGIN;

-- ---------------------------------------------------------------------------
-- A. Money safety (approval Q4). One tranche row per (invitation, tranche).
--    Without this, a double countersignature writes six escrow rows and pays
--    tranche 1 twice. The guarded UPDATEs stop it in the application; this
--    stops it in the database, which is the only place that cannot be raced.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_escrow_ci_tranche
  ON escrow_entries (campaign_influencer_id, tranche_number);

CREATE INDEX IF NOT EXISTS idx_escrow_ci
  ON escrow_entries (campaign_influencer_id);

-- ---------------------------------------------------------------------------
-- B. The agreement
-- ---------------------------------------------------------------------------

-- Three endings the agreement can reach that the old vocabulary had no word
-- for. Nothing deletes a contract row any more (approval Q8), so every ending
-- needs somewhere to be recorded.
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'withdrawn';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'declined';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'expired';

COMMIT;

-- New enum labels cannot be used in the same transaction that adds them.
BEGIN;

ALTER TABLE contracts
  -- Human-readable and unique: INFLX-2026-00123. Stamped at send.
  ADD COLUMN IF NOT EXISTS reference_no          text,
  -- THE SPINE. The whole agreed term set, copied once at send. The document
  -- reads only from here, so it can never drift from what was signed.
  ADD COLUMN IF NOT EXISTS terms_json            jsonb,
  ADD COLUMN IF NOT EXISTS terms_version         text,
  ADD COLUMN IF NOT EXISTS sent_at               timestamptz,
  ADD COLUMN IF NOT EXISTS sent_by               uuid REFERENCES users(id),
  -- How each signature was made. `trust proxy` is already set in app.js, so
  -- req.ip is the real client address behind Render.
  ADD COLUMN IF NOT EXISTS influencer_signed_ip     text,
  ADD COLUMN IF NOT EXISTS influencer_signed_device text,
  -- The brand's signer is a PERSON signing for the brand, named on the
  -- document. Until now only a user id was stored and the PDF printed the
  -- company name on the signature line.
  ADD COLUMN IF NOT EXISTS brand_signed_name     text,
  ADD COLUMN IF NOT EXISTS brand_signed_ip       text,
  ADD COLUMN IF NOT EXISTS brand_signed_device   text,
  -- The endings.
  ADD COLUMN IF NOT EXISTS withdrawn_at          timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_by          uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS declined_at           timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason        text,
  ADD COLUMN IF NOT EXISTS decline_note          text,
  ADD COLUMN IF NOT EXISTS expired_at            timestamptz,
  -- What the brand's signature actually did with money.
  ADD COLUMN IF NOT EXISTS locked_amount         numeric(12,2),
  ADD COLUMN IF NOT EXISTS campaign_fee_amount   numeric(12,2),
  ADD COLUMN IF NOT EXISTS released_amount       numeric(12,2),
  ADD COLUMN IF NOT EXISTS money_at              timestamptz,
  -- So a stored document can be proved not to have changed.
  ADD COLUMN IF NOT EXISTS pdf_sha256            text;

ALTER TABLE contracts
  ADD CONSTRAINT contracts_decline_note_len CHECK (decline_note IS NULL OR char_length(decline_note) <= 200)
  NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_reference
  ON contracts (reference_no) WHERE reference_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts (status);

-- The expiry job's scan: every agreement still out at a set's cutoff.
CREATE INDEX IF NOT EXISTS idx_contracts_open_unsigned ON contracts (status)
  WHERE status IN ('draft', 'pending_influencer', 'pending_brand');

-- Reference numbers come from a sequence so two simultaneous sends can never
-- collide and no number is ever reused. Gaps are fine; duplicates are not.
CREATE SEQUENCE IF NOT EXISTS contract_reference_seq;

-- ---------------------------------------------------------------------------
-- C. The standard terms — one versioned text, part of every agreement.
--    Stamped on the agreement at generation, so updating them never changes
--    an agreement already sent or signed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS standard_terms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version      text        NOT NULL UNIQUE,
  body_md      text        NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  is_current   boolean     NOT NULL DEFAULT false,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Exactly one current version, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS uq_standard_terms_current
  ON standard_terms (is_current) WHERE is_current;

-- Version 1.0 is the seven sentences that have lived inside pdf.service.js
-- since the beginning, moved out verbatim so that nothing already signed
-- changes meaning on the day this ships. Clauses 8 and 9 are new in v1.20.
INSERT INTO standard_terms (version, body_md, is_current)
VALUES ('1.0',
'1. The influencer agrees to create and publish content as specified above.
2. Content must be original, accurate, and comply with ASCI guidelines for sponsored content.
3. The brand retains the right to request up to the specified number of revisions.
4. Commission returns are subject to the return window stated in this agreement.
5. TDS of 10% will be deducted from withdrawals as per applicable Indian tax law.
6. Any disputes shall be resolved through the INFLX platform dispute resolution process.
7. This contract is governed by the laws of India.
8. The creator receives the agreed amount in full. The INFLX campaign fee is paid by the brand and is never deducted from a creator payment.
9. For Remote work the creator returns anything she does not keep within the period stated in this agreement, and the brand pays the return shipping.',
true)
ON CONFLICT (version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- D. The two new admin numbers, beside item 6's three (rules v1.20 §9).
--    The sales-commission return window is NOT duplicated here: it already
--    lives in payment_config with per-category overrides, and two homes for
--    one number is the trap item 6 closed. The admin page reads both.
-- ---------------------------------------------------------------------------
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label)
VALUES
  ('campaign_fee_pct',   8, 0, 30,  'percent', 'INFLX campaign fee'),
  ('remote_return_days', 7, 1, 60,  'days',    'Remote return window')
ON CONFLICT (key) DO NOTHING;

COMMIT;
