-- 198_shopper_ordering.sql
-- Contract: features/shopper-ordering · Docs/OFFER_TERMS_POSTS_RULES.md §6 (v1.13)
--
-- Ordering for the shopper app: the bag, one checkout per Place order, a parcel per brand
-- (follower_orders), a money row per post (follower_transactions: one creator, one offer), and
-- a row per item (order_lines) carrying the three-way split frozen at Place order (6.13).
--
-- ADDITIVE. Nothing dropped, nothing rewritten. Production on 30 Sep 2026: 0 follower_orders,
-- 0 follower_addresses, 16 seeded follower_transactions (left untouched).
--
--   1. follower_bag_items          — a signed-in shopper's bag (a guest's lives on the phone)
--   2. checkouts                   — one Place order: amounts, address snapshot, the 15-minute hold
--   3. order_lines                 — every item: its post, deal, paid share and its three shares
--   4. follower_orders             — + checkout_id, address snapshot, the brand's cancel/ship facts
--   5. follower_transactions       — + order_id (its parcel), checkout_id, platform_fee_reversed
--   6. follower_addresses          — + house, area, state (rules 6.7)
--   7. brand_dues                  — + what settled an order due (cash on delivery, 6.13)

BEGIN;

-- ─── 1. The bag ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follower_bag_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  post_id      uuid NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES brand_products(id) ON DELETE CASCADE,
  gift_item_id uuid REFERENCES gift_items(id) ON DELETE CASCADE,
  colour       text,
  size         text,
  qty          integer NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 5),
  role         text NOT NULL DEFAULT 'buy' CHECK (role IN ('buy', 'free', 'gift')),
  deal_key     text,
  ticked       boolean NOT NULL DEFAULT true,
  price_seen   numeric(10,2),
  added_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bag_item_has_thing CHECK (product_id IS NOT NULL OR gift_item_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_bag_follower ON follower_bag_items (follower_id, added_at);

-- ─── 2. Checkouts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkouts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id          uuid NOT NULL REFERENCES followers(id),
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'placed', 'expired', 'failed', 'refunded')),
  payment_method       text NOT NULL CHECK (payment_method IN ('online', 'cod')),
  address_id           uuid REFERENCES follower_addresses(id) ON DELETE SET NULL,
  address_snapshot     jsonb NOT NULL,
  items_normal         numeric(12,2) NOT NULL,
  savings              numeric(12,2) NOT NULL DEFAULT 0,
  delivery_fee         numeric(10,2) NOT NULL DEFAULT 0,
  cod_fee              numeric(10,2) NOT NULL DEFAULT 0,
  total                numeric(12,2) NOT NULL CHECK (total >= 0),
  priced               jsonb NOT NULL,          -- the priced groups and lines, frozen at Place order
  razorpay_order_id    text UNIQUE,
  razorpay_payment_id  text,
  refund_id            text,
  device_id            text,                   -- for the link channel of each post (4.14), reporting only
  expires_at           timestamptz,
  placed_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checkouts_follower ON checkouts (follower_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkouts_pending ON checkouts (expires_at) WHERE status = 'pending';

-- ─── 4. Parcels (before lines, which point at them) ─────────────────────────
ALTER TABLE follower_orders ADD COLUMN IF NOT EXISTS checkout_id uuid REFERENCES checkouts(id);
ALTER TABLE follower_orders ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id);
ALTER TABLE follower_orders ADD COLUMN IF NOT EXISTS address_snapshot jsonb;
ALTER TABLE follower_orders ADD COLUMN IF NOT EXISTS delivery_fee numeric(10,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_follower_orders_checkout ON follower_orders (checkout_id);
CREATE INDEX IF NOT EXISTS idx_follower_orders_brand ON follower_orders (brand_id, created_at DESC);

-- ─── 5. Money per post ───────────────────────────────────────────────────────
ALTER TABLE follower_transactions ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES follower_orders(id);
ALTER TABLE follower_transactions ADD COLUMN IF NOT EXISTS checkout_id uuid REFERENCES checkouts(id);
CREATE INDEX IF NOT EXISTS idx_ft_order ON follower_transactions (order_id);
-- A cancelled item takes no INFLX fee (6.13): what was taken back, next to commission_reversed and
-- brand_net_reversed. Settlement works commission GST on (fee − this).
ALTER TABLE follower_transactions ADD COLUMN IF NOT EXISTS platform_fee_reversed numeric(12,2) NOT NULL DEFAULT 0;

-- ─── 3. Every item ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_lines (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id            uuid NOT NULL REFERENCES checkouts(id),
  order_id               uuid NOT NULL REFERENCES follower_orders(id),
  transaction_id         uuid NOT NULL REFERENCES follower_transactions(id),
  follower_id            uuid NOT NULL REFERENCES followers(id),
  brand_id               uuid NOT NULL REFERENCES brands(id),
  post_id                uuid NOT NULL REFERENCES creator_posts(id),
  influencer_id          uuid NOT NULL REFERENCES influencers(id),
  campaign_influencer_id uuid NOT NULL REFERENCES campaign_influencers(id),
  offer_id               uuid REFERENCES brand_offers(id),
  product_id             uuid REFERENCES brand_products(id),
  gift_item_id           uuid REFERENCES gift_items(id),
  pool_item_id           uuid REFERENCES offer_pool_items(id),
  name                   text NOT NULL,
  image_url              text,
  colour                 text,
  size                   text,
  qty                    integer NOT NULL CHECK (qty >= 1),
  role                   text NOT NULL CHECK (role IN ('buy', 'free', 'gift')),
  deal_key               text,
  normal_unit            numeric(10,2) NOT NULL DEFAULT 0,
  normal_total           numeric(12,2) NOT NULL DEFAULT 0,
  paid_total             numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_total >= 0),
  -- The three-way split (6.13), frozen with the rates that made it.
  commission_pct         numeric(5,2) NOT NULL DEFAULT 0,
  commission             numeric(12,2) NOT NULL DEFAULT 0,
  fee_pct                numeric(5,2) NOT NULL DEFAULT 0,
  fee_source             text,
  platform_fee           numeric(12,2) NOT NULL DEFAULT 0,
  brand_net              numeric(12,2) NOT NULL DEFAULT 0,
  status                 text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancel_reason          text,
  cancel_note            text,
  cancelled_by           text CHECK (cancelled_by IS NULL OR cancelled_by IN ('shopper', 'brand', 'admin', 'system')),
  cancelled_at           timestamptz,
  refund_amount          numeric(12,2),
  refund_status          text CHECK (refund_status IS NULL OR refund_status IN ('pending', 'issued', 'failed', 'not_needed')),
  refund_id              text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT line_has_thing CHECK (product_id IS NOT NULL OR gift_item_id IS NOT NULL),
  CONSTRAINT line_split_adds_up CHECK (commission + platform_fee + brand_net = paid_total)
);
CREATE INDEX IF NOT EXISTS idx_order_lines_follower ON order_lines (follower_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines (order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_tx ON order_lines (transaction_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_post ON order_lines (post_id);

-- ─── 6. Addresses entered by hand (6.7) ─────────────────────────────────────
ALTER TABLE follower_addresses ADD COLUMN IF NOT EXISTS house text;
ALTER TABLE follower_addresses ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE follower_addresses ADD COLUMN IF NOT EXISTS state varchar(60);

-- ─── 7. Cash on delivery: what the brand owes (6.13) ────────────────────────
ALTER TABLE brand_dues ADD COLUMN IF NOT EXISTS settled_by_transaction_id uuid REFERENCES follower_transactions(id);
COMMENT ON COLUMN brand_dues.settled_by_transaction_id IS
  'Shopper ordering (198). A cash-on-delivery due (source_kind order) is taken from the brand''s next online sales payout; this names the sale whose payout settled it.';

COMMIT;

-- Post-migration checks (scripts/run-198.js --dry prints them):
--   SELECT count(*) FROM follower_bag_items;   -- 0 (new)
--   SELECT count(*) FROM checkouts;            -- 0 (new)
--   SELECT count(*) FROM order_lines;          -- 0 (new)
--   SELECT count(*), sum(net_amount) FROM follower_transactions;   -- unchanged (16, 165800.00)
