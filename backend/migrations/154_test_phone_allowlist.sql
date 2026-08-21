-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 154 — the test-number allowlist
-- Contract: features/stage-0-clear-the-decks  (Stage 0, job D)
--
-- WHY
-- The founder needs many accounts to test things like sending one invitation to
-- fifteen creators. His proposal was to flip OTP_MOCK on when he needs that and
-- off afterwards. That works only while nothing real exists — and it has already
-- gone wrong once: OTP_MOCK was left on in production from 19 Aug 09:23 until
-- 20 Aug, during which EVERY account on the platform could be signed into with
-- 000000. Verified from otp_codes: 8 of the 17 codes issued in that window were
-- 000000.
--
-- A global switch is the wrong shape. It is off when you need it and on when you
-- do not, and the blast radius is every user. So instead: a NAMED LIST of test
-- numbers gets the fixed code, and every other number always gets a real SMS —
-- with no setting able to override that. Nothing to flip, no exposed window.
--
-- WHY A TABLE AND NOT AN ENV VAR
-- The practice world seeds ~25 accounts and removes them again; maintaining that
-- as a comma-separated environment string is unworkable, and changing it needs a
-- service restart. A table is editable live, the seeder can register and
-- deregister its own numbers, and an admin screen can manage it later without a
-- migration.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS test_phone_numbers (
  phone       varchar(15) PRIMARY KEY,           -- E.164, matching users.phone
  note        text,                              -- why this number exists
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE test_phone_numbers IS
  'Numbers that receive the fixed login code instead of a real SMS (Stage 0, job D). '
  'Membership here is the ONLY way to get a fixed code — no environment flag can '
  'grant one, and a number absent from this table always receives a real SMS. '
  'Populated by the practice-world seeder and removable with it.';

COMMENT ON COLUMN test_phone_numbers.note IS
  'Free text — which practice account this is, so a stale row can be recognised.';
