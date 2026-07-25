-- 144_cod_checkout.sql — Cash on Delivery (Stage C3)
-- Contract: features/concept-stagec3-checkout/
--
-- Additive: follower_orders learns how it was paid. payment_method
-- 'prepaid' (Razorpay, default = every existing row, true historically) or
-- 'cod'. cod_fee is recorded ONCE per checkout on the primary (first)
-- order row; ₹0 on the rest. Money engine columns untouched — the fee is
-- platform revenue collected with the COD amount, never part of brand_net
-- or commission math. Knobs (cod_enabled/cod_fee) live in
-- follower_app_config JSONB — no schema needed there.

BEGIN;

ALTER TABLE follower_orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'prepaid',
  ADD COLUMN IF NOT EXISTS cod_fee numeric(10,2) NOT NULL DEFAULT 0;

COMMIT;
