-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 071 — Carved defect (backend-defect-pending-mandate-enum)
--
-- Adds 'pending_mandate' to the subscription_status enum.
--
-- Why: A6.5 / A13 (commit 03f0401) wired subscription.controller.upgrade to
-- INSERT a brand_subscriptions row with status='pending_mandate' as the
-- transitional state between *upgrade initiated* and *UPI mandate
-- authenticated via webhook*. The enum (defined in M058) only contained
-- active|paused|cancelled|past_due, so the INSERT fails with PG 22P02
-- (invalid_text_representation), the transaction rolls back, and the brand
-- sees a generic "VALIDATION_ERROR — Invalid ID format" toast in the UI.
-- Caught during end-to-end smoke test 2026-05-26 by founder.
--
-- Contract: features/backend-defect-pending-mandate-enum/.
--
-- Idempotent. Forward-only. Non-blocking on PG15 (Supabase).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'pending_mandate';
