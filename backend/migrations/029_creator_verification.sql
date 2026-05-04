-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029 — Verification state + YouTube handle on creator_profiles
--
-- Adds a 4-state verification machine (unclaimed/claimed/verified/rejected)
-- that tracks whether a scraped creator has been claimed by an Inflx user
-- and admin-confirmed.
--
-- Brand-facing UI exposes only one bit: "Verified" badge or nothing. The
-- four internal states are visible only to admins.
--
-- State transitions:
--   unclaimed → claimed       (user signs up, ig_handle OR youtube_handle matches)
--   claimed   → verified      (admin manually confirms identity)
--   claimed   → rejected      (admin denies — wrong person tried to claim)
--   rejected  → unclaimed     (admin reset, allows re-claim)
--
-- Conflict handling:
--   If a single user matches multiple creator_profiles (e.g. ig_handle hits
--   one row, youtube_handle hits another), all candidates get
--   claim_user_id set. The admin queue surfaces them as a conflict;
--   admin marks one 'claimed→verified', others 'rejected'.
--
-- Idempotent: uses IF NOT EXISTS / DO blocks.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Verification & claim columns ──────────────────────────────────────────
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT
    NOT NULL DEFAULT 'unclaimed'
    CHECK (verification_status IN ('unclaimed', 'claimed', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS youtube_handle      TEXT,
  ADD COLUMN IF NOT EXISTS claim_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_requested_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT;

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_creator_profiles_verification
  ON creator_profiles (verification_status);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_youtube_handle
  ON creator_profiles (youtube_handle) WHERE youtube_handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_claim_user
  ON creator_profiles (claim_user_id) WHERE claim_user_id IS NOT NULL;

-- Covers the admin verification queue:
--   SELECT … WHERE verification_status='claimed' ORDER BY claim_requested_at
CREATE INDEX IF NOT EXISTS idx_creator_profiles_claim_queue
  ON creator_profiles (verification_status, claim_requested_at)
  WHERE verification_status = 'claimed';

COMMIT;
