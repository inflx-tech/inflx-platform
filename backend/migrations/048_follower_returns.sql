-- Migration 048: follower_returns — customer-initiated returns workflow
-- with admin approval gating.
--
-- Flow:
--   1. Customer hits "Return this item" on OrderDetailScreen within the
--      product's return_policy_days window.
--   2. follower_returns row inserted with return_status='requested',
--      reason + reason_text from customer.
--   3. Notification fires to admin (admin queue).
--   4. Admin reviews via admin-web returns page:
--        approve  → status='approved'  → instructs customer to ship/drop
--        reject   → status='rejected'  → customer notified with admin_notes
--   5. (Out of scope for V1: 'received' status when brand confirms goods
--      back. Admin can flip directly to 'refunded' after coordinating
--      with brand.)
--   6. Admin flips approved → 'refunded' once refund is issued via
--      Razorpay Refunds API (or manual reversal). refunded_at set.
--
-- Refund mechanics live in a separate ticket — this migration just
-- captures the state machine + audit trail. The admin can attach a
-- razorpay_refund_id field later when the refund automation lands.

CREATE TYPE return_status AS ENUM (
  'requested',  -- customer initiated
  'approved',   -- admin OK; awaiting return shipment / pickup
  'rejected',   -- admin refused; closed
  'received',   -- brand confirmed receipt of goods (optional intermediate state)
  'refunded'    -- refund issued
);

CREATE TYPE return_reason AS ENUM (
  'wrong_size',
  'damaged',
  'not_as_described',
  'changed_mind',
  'other'
);

CREATE TABLE IF NOT EXISTS follower_returns (
  id                     uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id         uuid           NOT NULL REFERENCES follower_transactions(id),
  order_id               uuid           REFERENCES follower_orders(id),     -- online_order specifically (nullable for walk-in returns)
  product_id             uuid           REFERENCES brand_products(id),
  variant_id             uuid           REFERENCES product_variants(id),    -- when size/color matters
  reason                 return_reason  NOT NULL,
  reason_text            text,                                              -- free-text from customer
  return_status          return_status  NOT NULL DEFAULT 'requested',
  refund_amount          numeric(10,2),                                     -- set by admin on approval
  admin_notes            text,                                              -- visible to customer on rejection/details
  reviewed_by_admin_id   uuid           REFERENCES users(id),
  reviewed_at            timestamptz,
  refunded_at            timestamptz,
  razorpay_refund_id     varchar(80),                                       -- populated when refund automation runs
  created_at             timestamptz    DEFAULT now()
);

-- Admin queue lookup: WHERE return_status = 'requested'
CREATE INDEX IF NOT EXISTS idx_follower_returns_status
  ON follower_returns (return_status, created_at);

-- Customer's history: WHERE transaction_id IN (...)
CREATE INDEX IF NOT EXISTS idx_follower_returns_tx
  ON follower_returns (transaction_id);

-- Per-brand return-rate analytics (joins through transaction → brand_id)
CREATE INDEX IF NOT EXISTS idx_follower_returns_product
  ON follower_returns (product_id) WHERE product_id IS NOT NULL;
