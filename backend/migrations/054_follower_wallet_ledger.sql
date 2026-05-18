-- 054_follower_wallet_ledger.sql
-- Path C-2 — follower wallet.
--
-- Design choice: REWARD entries are NOT stored here. They are derived
-- read-time from follower_transactions (the canonical creator-attribution
-- table) so we don't have to hook every transaction-completion path
-- (pay-at-store / prebook / online-order verify) and risk regressions.
-- The ledger persists only the things that AREN'T derivable from
-- transactions: redemptions and manual adjustments.
--
-- Wallet summary math:
--   lifetime  = SUM(net_amount) * REWARD_PCT over the follower's
--               completed, creator-attributed follower_transactions
--   redeemed  = SUM(amount) of ledger entries WHERE entry_type='redeem'
--   adjust    = SUM(amount) of ledger entries WHERE entry_type='adjust'
--   available = lifetime - redeemed + adjust
--
-- When explicit per-event crediting (pending windows, expiry) is needed
-- later, 'reward' rows can start being written here without changing the
-- read model — the summary just switches its reward source.
--
-- Additive only.

CREATE TABLE IF NOT EXISTS follower_wallet_ledger (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id            uuid NOT NULL REFERENCES followers(id),
  entry_type             varchar(12) NOT NULL,   -- reward | redeem | adjust
  amount                 numeric(10,2) NOT NULL, -- always positive; entry_type gives direction
  status                 varchar(12) DEFAULT 'available', -- available | pending
  source_transaction_id  uuid REFERENCES follower_transactions(id),
  brand_id               uuid REFERENCES brands(id),
  campaign_influencer_id uuid REFERENCES campaign_influencers(id),
  note                   text,
  created_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_follower
  ON follower_wallet_ledger (follower_id, entry_type);

COMMENT ON TABLE  follower_wallet_ledger IS 'Path C-2 — follower wallet. Stores redeem/adjust only; reward balance is derived from follower_transactions read-time.';
COMMENT ON COLUMN follower_wallet_ledger.entry_type IS 'reward (reserved — derived today, may be persisted later) | redeem | adjust.';
COMMENT ON COLUMN follower_wallet_ledger.amount     IS 'Always positive. Direction implied by entry_type: reward/adjust add, redeem subtracts.';
