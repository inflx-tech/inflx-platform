-- 105 — Order Fulfillment Engine (Unit 1: status lifecycle + courier/tracking).
-- Forward-only + idempotent. ALTER TYPE ... ADD VALUE is non-transactional in PG
-- (precedent: 038, 075) — IF NOT EXISTS makes re-runs safe. Values are only ADDED
-- here, never USED in this file, so it is safe alongside the ALTER TABLE.
--
-- Status lifecycle (5 steps + cancel): confirmed -> packed -> dispatched(=Shipped)
-- -> out_for_delivery -> delivered ; cancelled (terminal). 'dispatched' is kept as
-- the "Shipped" step (back-compat) rather than renamed.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'packed' AFTER 'confirmed';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'out_for_delivery' AFTER 'dispatched';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE follower_orders
  ADD COLUMN IF NOT EXISTS courier_name        varchar(80),
  ADD COLUMN IF NOT EXISTS tracking_number     varchar(120),
  ADD COLUMN IF NOT EXISTS packed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS out_for_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at        timestamptz;
