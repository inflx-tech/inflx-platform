-- 207 — Place order happens once: a checkout remembers the key of the attempt that made it.
-- Contract: features/listing-shop-safety · 05-impact.md (C)
--
-- "Place order" had no once-only guard. When the server was slow the shopper app said "please
-- retry", she tapped again, and a cash-on-delivery order was written twice; paying online, her
-- first try held the last piece and her second said "Sold out".
--
--   client_key  the key the shopper app sends with one order attempt, and sends again when it
--               retries that same attempt. A repeated key is answered with the checkout already
--               made. NULL for every checkout made before this, and for an app that sends none.
--
-- One key means one checkout per shopper: the partial unique index is what makes two requests
-- arriving in the same instant safe (the second is refused by the database and rolled back).
--
-- ADDITIVE and idempotent. No existing row is written: the column arrives NULL.

BEGIN;

ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS client_key text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkouts_client_key_len') THEN
    ALTER TABLE checkouts ADD CONSTRAINT checkouts_client_key_len
      CHECK (client_key IS NULL OR char_length(client_key) BETWEEN 8 AND 64);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_checkouts_follower_client_key
  ON checkouts (follower_id, client_key) WHERE client_key IS NOT NULL;

COMMENT ON COLUMN checkouts.client_key IS
  'listing-shop-safety (C). The key of the Place order attempt that made this checkout; a repeated key is answered with this checkout. NULL = made before this, or by an app that sends none.';

COMMIT;
