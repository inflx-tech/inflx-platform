-- 118 — Food World 3C-1: per-dish MRP (struck price).
--
-- Adds brand_products.mrp — the "was" price shown struck-through next to the
-- live price (e.g. ₹99 ~~₹169~~). Founder decision 2026-06-22: reverses the
-- earlier scope cut that dropped original/compare-at price. The struck price
-- is shown by the dish card / detail popup ONLY when mrp IS NOT NULL AND
-- mrp > price. A live brand_offer (if any) still overlays an ADDITIONAL
-- discount on top of `price` at checkout — mrp is display-only and never
-- feeds order pricing.
--
-- Forward-only, ADDITIVE, IDEMPOTENT (ADD COLUMN IF NOT EXISTS). Nullable, no
-- default → zero effect on existing rows / non-food products. No existing
-- column altered or dropped. Highest prior migration = 117; next free = 118.

ALTER TABLE brand_products
  ADD COLUMN IF NOT EXISTS mrp numeric(10,2);

COMMENT ON COLUMN brand_products.mrp IS
  'Food World 3C-1 — optional per-dish MRP / "was" price. Shown struck-through next to price when mrp > price. Display-only; never used for order pricing (offers overlay separately).';
