-- 211_product_approval_switch.sql
-- Product approval — the admin switch. Contract: features/product-approval-switch.
--
-- ONE SETTING ROW, arriving at 0 — OFF — which is exactly today's behaviour: a brand's
-- published product is live at once. Applying this migration changes nothing for anybody
-- until an admin turns the switch on from Admin → Settings → Platform.
--
-- FOUR COLUMNS on brand_products, additive, with `approved` as the default so every product
-- that exists today — and every product published while the switch is off — is approved and
-- untouched. pushed_to_store stays the one live flag (spec §2); these columns only say why a
-- product is NOT pushed yet, and who decided.
--
-- Idempotent.

BEGIN;

INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
  ('product_approval_required', 0, 0, 1, 'on/off', 'Product approval')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE brand_products
  ADD COLUMN IF NOT EXISTS approval_status       text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_decided_at   timestamptz,
  ADD COLUMN IF NOT EXISTS approval_decided_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_note         text;

ALTER TABLE brand_products DROP CONSTRAINT IF EXISTS brand_products_approval_status_check;
ALTER TABLE brand_products ADD CONSTRAINT brand_products_approval_status_check
  CHECK (approval_status IN ('approved', 'pending', 'rejected', 'withdrawn'));

-- The queue reads the waiting ones, oldest first.
CREATE INDEX IF NOT EXISTS idx_brand_products_approval_pending
  ON brand_products (approval_requested_at)
  WHERE approval_status = 'pending';

COMMIT;
