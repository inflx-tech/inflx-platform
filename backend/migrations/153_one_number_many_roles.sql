-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 153 — one number, many roles
-- Contract: features/stage-0-clear-the-decks  (Stage 0, job C)
--
-- WHY
-- users.phone has been UNIQUE since migration 001, so a phone number could hold
-- exactly one account with exactly one role. The founder needs his number to be
-- superadmin AND a brand AND a creator AND a follower, so he can walk every flow
-- himself. Today the creator app refuses him outright:
--   "This phone is registered as Brand. Please install the Brand app."
-- (Packages/Mobile/src/screens/auth/OTPScreen.js — the role guard.)
--
-- THE RULE, EXACTLY AS THE FOUNDER STATED IT
-- One number per ROLE. A number may appear once as a brand, once as a creator,
-- once as a follower, once as an admin — and never twice in the same role. So a
-- single brand can never be reachable on two different numbers.
--
-- WHY IT IS SAFE HERE
-- This runs immediately AFTER the Stage 0 wipe, against empty user tables, so
-- there are no existing rows to conflict. Run before the wipe and it is still
-- safe — dropping a UNIQUE constraint never fails on existing data, and the new
-- composite is strictly weaker. The order is chosen for clarity, not necessity.
--
-- WHAT THIS DOES *NOT* DO
-- It does not merge accounts, share wallets, or add an in-app "switch role"
-- button. Each role remains a separate account row with its own id, its own
-- approval, its own wallet and its own notifications — which is correct: a
-- brand's float must never be the same pot as a creator's earnings. The business
-- rules for a creator who is genuinely also a brand (proving ownership, no
-- commission on own sales, per-product commission on mixed posts) are Stage 9
-- and are untouched here.
--
-- Forward-only. Additive in effect: every previously-valid row stays valid.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Drop the single-column uniqueness ────────────────────────────────────────
-- Named explicitly rather than guessed: verified against production 2026-08-20
-- as users_phone_key.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;

-- ── Add uniqueness per (phone, role) ─────────────────────────────────────────
-- This is the founder's rule expressed as a constraint. A second brand account
-- on the same number is refused by the database, not merely by application code.
ALTER TABLE users
  ADD CONSTRAINT users_phone_role_key UNIQUE (phone, role);

COMMENT ON CONSTRAINT users_phone_role_key ON users IS
  'One number per role (Stage 0, job C). A phone may hold a brand, a creator, a '
  'follower and an admin account, but never two of the same role. Replaces the '
  'original users_phone_key from migration 001.';

-- ── Lookup support ───────────────────────────────────────────────────────────
-- Login now resolves on (phone, role); the composite unique index above already
-- serves that. A phone-only index still earns its place: the "which accounts
-- does this number hold?" path (auth.controller, ambiguous-role case) and the
-- admin queues both search on phone alone.
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
