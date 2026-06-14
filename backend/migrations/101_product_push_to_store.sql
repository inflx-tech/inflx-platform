-- ============================================================================
-- Migration 101 — Product push-to-store flag
--   (contract: features/merch-engine-p2a-product-push-store)
-- ----------------------------------------------------------------------------
-- Per-product "show in store" gate. The brand store renders only products with
-- pushed_to_store = true. Defaults TRUE so existing + new products stay visible
-- (parity with today); brands curate by un-pushing. Offers already have an
-- equivalent (brand_offers.published_to_store, mig 084).
--
-- Additive · idempotent · behaviour-preserving on deploy.
-- ============================================================================

BEGIN;

ALTER TABLE brand_products
  ADD COLUMN IF NOT EXISTS pushed_to_store boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_brand_products_pushed
  ON brand_products (brand_id, pushed_to_store)
  WHERE is_active;

COMMIT;
