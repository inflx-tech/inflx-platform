-- 205 — courier-ready addresses: a landmark and a store phone on a branch.
-- Contract: features/courier-ready-addresses · 05-impact.md
--
-- A courier's pickup address is two lines and a phone. A branch has had one line (the typed
-- street address) and no phone of its own — the owner's login number was handed to the courier.
--
--   landmark  the second address line ("Opposite JNTU metro station"). Optional, up to 45
--             characters; the street is held to 140, so the two together fit the 190 a courier keeps.
--   phone     the number the courier calls at THIS branch. Ten digits. NULL means "the brand's
--             login number", which is what every branch that exists today will go on using.
--
-- ADDITIVE and idempotent. No existing row is written: both columns arrive NULL.

BEGIN;

ALTER TABLE brand_branches ADD COLUMN IF NOT EXISTS landmark text;
ALTER TABLE brand_branches ADD COLUMN IF NOT EXISTS phone    text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brand_branches_landmark_len') THEN
    ALTER TABLE brand_branches ADD CONSTRAINT brand_branches_landmark_len
      CHECK (landmark IS NULL OR char_length(landmark) <= 45);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brand_branches_phone_ten_digits') THEN
    ALTER TABLE brand_branches ADD CONSTRAINT brand_branches_phone_ten_digits
      CHECK (phone IS NULL OR phone ~ '^[6-9][0-9]{9}$');
  END IF;
END $$;

COMMENT ON COLUMN brand_branches.landmark IS
  'courier-ready-addresses. The second address line a courier is given. Optional, <= 45 characters.';
COMMENT ON COLUMN brand_branches.phone IS
  'courier-ready-addresses. The 10-digit mobile the courier calls at this branch. NULL = the brand''s login number.';

COMMIT;
