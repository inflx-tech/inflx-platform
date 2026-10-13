-- 208 — a creator's own delivery address, and the rest of her bank details.
-- Contract: features/creator-address-bank-save · 05-impact.md
--
-- 1. Her delivery address, kept once in her profile.
--    Until now the only street address INFLX held for a creator was the one she typed into a
--    Remote collaboration, for that brand, each time (production_events.ship_to_*). This is the
--    address she keeps: the Remote form starts from it, and she may change it there for that one
--    parcel. The two never write to each other — what she sent a brand stays a snapshot (§28).
--
--    It is its OWN table on purpose. The influencers row is read whole (`i.*`) in more than one
--    place that answers a brand or a shopper; a street address on that row would travel with it.
--    Nothing reads this table except her own profile and her own Remote form.
--
-- 2. Her bank account, completed: the account holder's name, the bank and the branch, beside the
--    account number and IFSC she already saves. INFLX pays withdrawals by hand from its bank, and
--    a name that does not match the account is the commonest reason one is refused.
--    A withdrawal request keeps its own copy (as it already does for the number and the IFSC), so
--    a later change of details never rewrites a request already made.
--
-- ADDITIVE and idempotent. No existing row is written: one new empty table, and five new columns
-- that arrive NULL.

BEGIN;

CREATE TABLE IF NOT EXISTS creator_delivery_addresses (
  influencer_id uuid PRIMARY KEY REFERENCES influencers(id) ON DELETE CASCADE,
  name          text NOT NULL,
  phone         text NOT NULL,
  street        text NOT NULL,
  pincode       text NOT NULL,
  state_id      smallint NOT NULL REFERENCES ref_states(id),
  city_id       integer  NOT NULL REFERENCES ref_cities(id),
  state_name    text NOT NULL,
  city_name     text NOT NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_delivery_addresses_pincode CHECK (pincode ~ '^[0-9]{6}$'),
  CONSTRAINT creator_delivery_addresses_phone   CHECK (phone ~ '^[6-9][0-9]{9}$'),
  CONSTRAINT creator_delivery_addresses_street  CHECK (char_length(street) BETWEEN 1 AND 190)
);

COMMENT ON TABLE creator_delivery_addresses IS
  'creator-address-bank-save. The delivery address a creator keeps in her profile — one per creator. PRIVATE to her: no brand, shopper or public read touches this table. A Remote collaboration form starts from it; what she then sends that brand is a separate snapshot on production_events.ship_to_* and neither ever rewrites the other.';

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS bank_holder_name text,
  ADD COLUMN IF NOT EXISTS bank_name        text,
  ADD COLUMN IF NOT EXISTS bank_branch      text;

COMMENT ON COLUMN influencers.bank_holder_name IS
  'creator-address-bank-save. The name on her bank account, as she typed it. Saved together with bank_account_no, bank_ifsc, bank_name and bank_branch — one entry. NULL on an account saved before this. Never sent back to any screen.';
COMMENT ON COLUMN influencers.bank_name IS
  'creator-address-bank-save. Her bank, as she typed it. NULL on an account saved before this.';
COMMENT ON COLUMN influencers.bank_branch IS
  'creator-address-bank-save. Her branch, as she typed it. NULL on an account saved before this.';

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS bank_name   text,
  ADD COLUMN IF NOT EXISTS bank_branch text;

COMMENT ON COLUMN withdrawal_requests.bank_name IS
  'creator-address-bank-save. The bank, copied from her details when she asked — beside account_enc, ifsc and payee_name. NULL for a UPI request, a brand request, and a request made before this.';
COMMENT ON COLUMN withdrawal_requests.bank_branch IS
  'creator-address-bank-save. The branch, copied when she asked. NULL as bank_name.';

COMMIT;
