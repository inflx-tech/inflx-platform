-- ============================================================================
-- Migration 108 — Referral Applications (Intake: apply-to-become-referrer)
-- ----------------------------------------------------------------------------
-- Intake layer on top of the existing referral engine (mig 078/079). An
-- influencer (agency later) applies to become a REFERRER; admin reviews and on
-- APPROVE the existing referralService.getOrCreateCode allocates their code.
--
-- Additive + idempotent + forward-only (per migration convention). One new
-- table, no destructive change. Status uses a text CHECK constraint to match
-- the rest of the referral engine (referral_codes/edges/ledger all use CHECK,
-- not custom enum types) so the table is inherently re-runnable.
-- ============================================================================

BEGIN;

-- ── referral_applications — one row per apply-to-become-referrer request ─────
CREATE TABLE IF NOT EXISTS referral_applications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_type text NOT NULL DEFAULT 'influencer'
                   CHECK (applicant_type IN ('influencer','agency')),
  applicant_id   uuid NOT NULL,
  status         text NOT NULL DEFAULT 'requested'
                   CHECK (status IN ('requested','approved','rejected')),
  note           text NULL,
  allocated_code text NULL,            -- set on approve from referral_codes.code
  created_at     timestamptz NOT NULL DEFAULT now(),
  decided_at     timestamptz NULL,
  decided_by     uuid NULL             -- admin user id who approved/rejected
);

-- list/filter path: admin Applications panel orders newest-first, filters status
CREATE INDEX IF NOT EXISTS idx_referral_applications_status
  ON referral_applications (status, created_at DESC);

-- guard against duplicate PENDING applications per applicant (one open request
-- at a time). Decided rows (approved/rejected) don't block a future re-apply.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_referral_application_pending
  ON referral_applications (applicant_type, applicant_id)
  WHERE status = 'requested';

COMMIT;
