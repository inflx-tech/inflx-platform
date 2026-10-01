-- 200_item17_wallet.sql
-- Contract: features/item17-wallet · master rules v1.31 §17A · boards locked 1 Oct 2026
--
-- Item 17 — the Wallet, complete. What this migration adds:
--   1. the hold: `withdrawal_hold` on brands and influencers. A withdrawal request moves the
--      amount OUT of wallet_balance (so nothing can spend it or request it twice) INTO the hold;
--      Processed takes it out of the hold (the money has left INFLX); Could not process moves it
--      back. wallet_balance therefore stays "Available" everywhere it is read or spent.
--   2. withdrawal_requests — ONE model for brands and creators (W5). The old brand_withdrawals
--      and influencer_withdrawals tables keep their history and are no longer written.
--   3. wallet_topup_orders — every add-money order, so a payment is credited ONCE (and one the
--      bank received but the wallet did not get can be found and credited by Admin, AM9). It
--      also replaces the in-memory map the mock used, which a restart emptied.
--   4. a unique index: one top-up credit per Razorpay payment.
--   5. money_corrections — the three by-hand tools' record (AM11): reason required.
--   6. ledger types: sales money added to a brand's wallet (W3), the hold, its release, the
--      payout, a correction.
--   7. settings: the 24 hours (AM12).
--
-- ADDITIVE. NO BACKFILL. MONEY: this migration moves none. scripts/run-200.js reads it before
-- and after, and reports any payment credited twice BEFORE the unique index is created.

-- ─── 1. The hold ─────────────────────────────────────────────────────────────
ALTER TABLE brands      ADD COLUMN IF NOT EXISTS withdrawal_hold numeric(12,2) NOT NULL DEFAULT 0 CHECK (withdrawal_hold >= 0);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS withdrawal_hold numeric(12,2) NOT NULL DEFAULT 0 CHECK (withdrawal_hold >= 0);
COMMENT ON COLUMN brands.withdrawal_hold IS
  'Item 17. Money a withdrawal request has taken out of wallet_balance (Available) and INFLX has not yet paid. It is still held by INFLX for the brand; it cannot be spent or requested again.';

-- ─── 2. One withdrawal model ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind      text NOT NULL CHECK (owner_kind IN ('brand', 'creator')),
  brand_id        uuid REFERENCES brands(id) ON DELETE RESTRICT,
  influencer_id   uuid REFERENCES influencers(id) ON DELETE RESTRICT,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  method          text NOT NULL CHECK (method IN ('bank', 'upi')),
  -- Where to send it, as it stood when she asked: a later change to her details never moves a
  -- request already made. The account number / UPI id is stored encrypted, as on her profile.
  payee_name      text NOT NULL,
  account_enc     text,
  ifsc            varchar(12),
  upi_enc         text,
  payee_masked    text NOT NULL,
  status          text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processed', 'could_not_process')),
  requested_by    uuid NOT NULL,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  process_hours   smallint NOT NULL DEFAULT 24,       -- what she was told (stamped; AM12)
  -- Processed: INFLX paid it from its bank, then recorded it.
  bank_reference  text,
  paid_on         date,
  processed_at    timestamptz,
  processed_by    uuid,
  -- Could not process: the reason is what the person reads.
  reason_kind     text,
  reason          text CHECK (reason IS NULL OR char_length(reason) <= 500),
  CHECK ((owner_kind = 'brand') = (brand_id IS NOT NULL)),
  CHECK ((owner_kind = 'creator') = (influencer_id IS NOT NULL)),
  CHECK (status <> 'processed' OR (bank_reference IS NOT NULL AND btrim(bank_reference) <> '' AND processed_at IS NOT NULL)),
  CHECK (status <> 'could_not_process' OR (reason IS NOT NULL AND btrim(reason) <> '' AND processed_at IS NOT NULL))
);
-- One open request at a time (W5).
CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawal_open_brand   ON withdrawal_requests (brand_id)      WHERE status = 'requested' AND brand_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawal_open_creator ON withdrawal_requests (influencer_id) WHERE status = 'requested' AND influencer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests (status, requested_at);
COMMENT ON TABLE withdrawal_requests IS
  'Item 17 (rules v1.31 §17A). The only way money leaves INFLX to a brand or a creator: requested (on hold) → processed (INFLX paid from its bank and recorded the reference; the hold is taken) or could_not_process (the hold goes back to Available, with the reason). No approval step, no automatic payout, no deduction.';

-- ─── 3. Every add-money order ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_topup_orders (
  order_id      varchar(80) PRIMARY KEY,
  brand_id      uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  status        text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'credited')),
  payment_id    varchar(80),
  created_at    timestamptz NOT NULL DEFAULT now(),
  credited_at   timestamptz,
  credited_how  text CHECK (credited_how IS NULL OR credited_how IN ('verify', 'admin')),
  credited_by   uuid
);
CREATE INDEX IF NOT EXISTS idx_topup_orders_brand ON wallet_topup_orders (brand_id, created_at DESC);

-- ─── 4. One credit per payment ───────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_topup_payment
  ON wallet_transactions (razorpay_payment_id) WHERE type = 'topup' AND razorpay_payment_id IS NOT NULL;

-- ─── 5. The by-hand tools' record ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS money_corrections (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                   text NOT NULL CHECK (kind IN ('release_payment', 'return_locked', 'correct_balance', 'credit_topup')),
  brand_id               uuid REFERENCES brands(id),
  influencer_id          uuid REFERENCES influencers(id),
  campaign_influencer_id uuid REFERENCES campaign_influencers(id),
  amount                 numeric(12,2) NOT NULL,
  direction              text NOT NULL CHECK (direction IN ('credit', 'debit')),
  reason                 text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 500),
  admin_user_id          uuid NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- ─── 6. Ledger types ─────────────────────────────────────────────────────────
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'sale_settlement';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'withdrawal_hold';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'withdrawal_paid';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'withdrawal_release';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'adjustment';

-- What a ledger row is about: the sale, the withdrawal, the correction. Lets history say it in plain words.
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS source_ref_id uuid;

-- ─── 7. The 24 hours ─────────────────────────────────────────────────────────
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
  ('withdrawal_process_hours', 24, 1, 168, 'hours', 'Withdrawals processed within')
ON CONFLICT (key) DO NOTHING;

-- Post-migration checks (scripts/run-200.js prints them):
--   SELECT count(*) FROM withdrawal_requests;                       -- 0
--   SELECT sum(withdrawal_hold) FROM brands / influencers;          -- 0
--   wallets, pending, escrow, contracts, ledgers — identical before and after.
