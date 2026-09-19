-- 189_change_login_number.sql
-- Contract: features/change-login-number (spec + mockups locked 19 Sep 2026)
--
-- A person can move their account to a new phone number from inside the app: a code to the old
-- number, then a code to the new one. The change rewrites users.phone for that role only and is
-- recorded here so the team can answer "who changed this number, from what, when".

BEGIN;

CREATE TABLE IF NOT EXISTS phone_changes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        varchar(20) NOT NULL,
  old_phone   varchar(15) NOT NULL,
  new_phone   varchar(15) NOT NULL,
  ip          text,
  user_agent  text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phone_changes_user ON phone_changes (user_id, changed_at DESC);
COMMENT ON TABLE phone_changes IS 'Audit of login-number changes (change-login-number §3 rule 9). One row per confirmed change.';

COMMIT;
