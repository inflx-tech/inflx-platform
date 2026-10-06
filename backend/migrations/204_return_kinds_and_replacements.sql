-- 204 — shopper-deal-orders, part B (features/shopper-deal-orders · 01-spec.md B1–B8 · the founder's
-- rules D2, D3, D5 of 5 Oct 2026): one item of a deal is replaced, or its share refunded.
--
-- A shopper's request (follower_returns) now has a KIND:
--   return       the items go back and are refunded — every request that exists today
--   replace      one item is exchanged for another size (or the same item again); no money moves
--   refund_item  one item's share is refunded and she keeps the rest of the deal (the store's fault,
--                and it cannot replace)
-- A replacement says what the item is replaced WITH, and where the replacement is: to send → sent →
-- delivered. When it is delivered the request ends as 'replaced', and the sale's return window runs
-- again from that delivery (return_window_restart_at) — the money jobs read it.
--
-- ADDITIVE and idempotent. No existing row changes: every request that exists is kind 'return'
-- (the column's default), and return_window_restart_at is empty for every sale.

-- A new state of a request. (ALTER TYPE … ADD VALUE stands outside the transaction below; the
-- value is not used in this file.)
ALTER TYPE return_status ADD VALUE IF NOT EXISTS 'replaced';

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'return';
ALTER TABLE follower_returns DROP CONSTRAINT IF EXISTS follower_returns_kind_check;
ALTER TABLE follower_returns ADD  CONSTRAINT follower_returns_kind_check CHECK (kind IN ('return', 'replace', 'refund_item'));

-- What she has, and what it is replaced with (a replacement only).
ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS from_colour text;
ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS from_size   text;
ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS to_colour   text;
ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS to_size     text;

-- Where the replacement is. NULL until INFLX approves it; the brand marks it sent, then delivered.
ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS replacement_status       text;
ALTER TABLE follower_returns DROP CONSTRAINT IF EXISTS follower_returns_replacement_status_check;
ALTER TABLE follower_returns ADD  CONSTRAINT follower_returns_replacement_status_check
  CHECK (replacement_status IS NULL OR replacement_status IN ('to_send', 'sent', 'delivered'));
ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS replacement_sent_at      timestamptz;
ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS replacement_delivered_at timestamptz;

-- A replacement whose item sold out before INFLX could approve it is closed by the stock, not by
-- INFLX: it is not INFLX's one answer for that item, and she may choose again.
ALTER TABLE follower_returns ADD COLUMN IF NOT EXISTS sold_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN follower_returns.kind IS 'return (items go back, refunded) · replace (one item exchanged, no money moves) · refund_item (one item''s share refunded, she keeps the rest of the deal).';
COMMENT ON COLUMN follower_returns.replacement_status IS 'A replacement only: to_send (approved by INFLX) → sent → delivered (both marked by the brand).';

-- After a replacement is delivered the sale''s return window runs again from that delivery.
ALTER TABLE follower_transactions ADD COLUMN IF NOT EXISTS return_window_restart_at timestamptz;
COMMENT ON COLUMN follower_transactions.return_window_restart_at IS 'Set when a replacement for this sale is delivered: the return window then runs from this moment instead of the first delivery. NULL = never replaced.';

CREATE INDEX IF NOT EXISTS idx_follower_returns_replacements ON follower_returns (replacement_status) WHERE kind = 'replace';

COMMIT;
