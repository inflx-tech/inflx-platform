-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 074 — Wave 1 commit 1: payment_config T3 release time-of-day
--
-- Adds admin-controllable IST clock time at which T3 tranches release.
-- Today T3 fires at the first hourly cron tick after the day boundary
-- crosses; post-fix the cron also checks that the IST clock time has
-- passed `tranche_3_release_time_ist` (default 03:00 IST, off-hours).
--
-- Contract: features/wave1-tax-config-foundation/.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE payment_config
  ADD COLUMN IF NOT EXISTS tranche_3_release_after_days int  NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS tranche_3_release_time_ist   time NOT NULL DEFAULT '03:00:00';

COMMIT;
