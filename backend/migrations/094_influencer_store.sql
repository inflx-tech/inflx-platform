-- ============================================================================
-- Migration 094 — Influencer Store foundation (contract: influencer-store-foundation)
-- ----------------------------------------------------------------------------
-- The one genuinely-new piece of the commission model: a real influencer
-- STOREFRONT. An influencer shelves products from brands they are CONTRACTED
-- with (contract-gate enforced at stock time in the service layer). Buying
-- inside a creator's store becomes a store-context attribution signal
-- (store beats window, never expires, refreshes window) — wired in a later slice.
--
-- Additive · idempotent · forward-only. DORMANT on deploy: no caller writes
-- inventory and no transaction path reads via_store_influencer_id yet, so
-- nothing in the live money flow changes until the stocking UI + attribution
-- wiring land.
-- ============================================================================

BEGIN;

-- ── influencer_store_inventory — products a creator has shelved ──────────────
CREATE TABLE IF NOT EXISTS influencer_store_inventory (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES influencers(id)     ON DELETE CASCADE,
  brand_id      uuid NOT NULL REFERENCES brands(id)          ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES brand_products(id)  ON DELETE CASCADE,
  note          text,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','archived')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (influencer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_isi_influencer ON influencer_store_inventory (influencer_id, status);
CREATE INDEX IF NOT EXISTS idx_isi_product    ON influencer_store_inventory (product_id);

-- ── store-context attribution column (DORMANT until the attribution slice) ────
-- Which influencer's store a sale happened inside. NULL on every existing row →
-- no behaviour change. Read by classifyPath (store > live-link > window > direct)
-- once the transaction paths thread it through.
ALTER TABLE follower_transactions
  ADD COLUMN IF NOT EXISTS via_store_influencer_id uuid REFERENCES influencers(id) ON DELETE SET NULL;

COMMIT;
