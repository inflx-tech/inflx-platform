-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 148 — allocation owns its own scope + offers get their own expiry
-- Contract: features/collab-part4-offers-allocation (§4.1, §4.4)
--
-- THE PROBLEM
-- Today what a creator may SELL is derived from the OFFER's scope:
-- resolveAllocatedProductIds reads offer_config_json.scope. That single read is
-- the conflation behind three separate faults:
--
--   1. No offer  →  no scope  →  no products. A creator cannot sell at full
--      price on commission alone, and it is blocked in SEVEN places (including
--      validateTracking, so such a sale cannot even be recorded).
--   2. Editing an offer silently rewrites what the creator was allowed to sell.
--   3. A creator allocated "the whole store" with an offer scoped to one
--      category is inexpressible — the two meanings share one field.
--
-- THE MODEL (founder, 2026-08-11)
-- Allocation and offers are independent axes:
--   · allocation = what the creator MAY SELL   → these columns
--   · offer      = what the CUSTOMER SAVES     → offer_config_json, unchanged
--   · commission = what the CREATOR EARNS      → commission_pct, unchanged
--
-- Allocation is a DECLARED SCOPE RESOLVED LIVE, not a frozen snapshot:
--   store    → every published product; new products AUTO-JOIN (founder's
--              explicit choice)
--   category → that node's subtree; new products in it auto-join
--   products → a fixed list; nothing auto-joins
-- Unpublishing is the brand's lever — an unpublished product leaves the store
-- and therefore leaves every store/category allocation automatically.
--
-- WHY NO BACKFILL HERE
-- Deriving each existing row's scope means collecting product ids out of five
-- different offer_config_json shapes (products / d_prods / v_prods / bnd_prods /
-- bogo buy+get / free-gift main+gift pairs). That logic already exists in JS as
-- offerConfig.validator.collectProductIds, and re-implementing it in SQL would
-- be a second copy that can drift — the exact fault Part 1 fixed for the offer
-- vocabulary. So the backfill lives in scripts/run-148.js, which also asserts
-- every migrated collaboration resolves to the SAME product set as before
-- (contract workflow W6). This file is pure additive DDL.
--
-- NULL alloc_scope = "not yet allocated". The resolver returns no products and
-- the creator is not surfaced (W8).
--
-- ONE TRANSITIONAL EXCEPTION: while alloc_scope is NULL the resolver falls back
-- to the offer's scope, logging each time. This is not part of the model — it
-- exists only to survive the deploy window. Rows written by the old code, and any
-- created between this backfill and the backend deploy, carry no allocation, and
-- without the fallback the 19 live collaborations would resolve to zero products
-- and every creator storefront would go blank. Delete the fallback once
-- `SELECT count(*) FROM campaign_influencers WHERE alloc_scope IS NULL AND
-- offer_type IS NOT NULL` returns 0.
--
-- Idempotent. Additive only. No column dropped, no constraint that could reject
-- historical rows before the backfill runs.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── §4.1 allocation scope ───────────────────────────────────────────────────
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS alloc_scope            text;
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS alloc_category_node_id uuid REFERENCES category_nodes(id) ON DELETE SET NULL;
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS alloc_category         text;
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS alloc_product_ids      jsonb;

-- Deliberately NOT a CHECK constraint: rows are NULL until run-148 backfills
-- them, and a constraint would also block any future scope shape from landing
-- additively. The application validates the value on write instead.
COMMENT ON COLUMN campaign_influencers.alloc_scope IS
  'What this creator MAY SELL: store | category | products. NULL = not yet allocated (resolver returns no products; creator is not surfaced). Independent of the offer''s own scope, which governs what the DISCOUNT applies to. See features/collab-part4-offers-allocation.';
COMMENT ON COLUMN campaign_influencers.alloc_category_node_id IS
  'Category-scoped allocation: the node whose SUBTREE the creator may sell. Resolved live, so products added to the subtree later auto-join.';
COMMENT ON COLUMN campaign_influencers.alloc_category IS
  'Display/legacy label for the allocated category (brand_products.section fallback when no taxonomy node exists).';
COMMENT ON COLUMN campaign_influencers.alloc_product_ids IS
  'Product-scoped allocation: a FIXED array of brand_products ids. Unlike store/category scope, nothing auto-joins.';

CREATE INDEX IF NOT EXISTS idx_ci_alloc_scope
  ON campaign_influencers (alloc_scope) WHERE alloc_scope IS NOT NULL;

-- ── §4.4 offer expiry ───────────────────────────────────────────────────────
-- NOT to be confused with campaign_influencers.offer_expires_at, which is the
-- INVITATION-acceptance clock (mirrored from posting_date and driven by
-- offer-expiry.job, which auto-expires unaccepted invites). Reusing that column
-- for a discount deadline would silently expire invitations — which is exactly
-- why the discount has never had a deadline of its own and instead died with the
-- campaign. Hence a separate, unambiguously named column.
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS offer_valid_until timestamptz;

COMMENT ON COLUMN campaign_influencers.offer_valid_until IS
  'When this creator''s campaign-level OFFER stops discounting. NULL = no deadline. The allocation, storefront and commission continue past it — only the discount stops. Distinct from offer_expires_at, which is the invitation-acceptance clock.';

COMMIT;

-- Post-migration checks (informational — run manually):
--   SELECT alloc_scope, count(*) FROM campaign_influencers GROUP BY 1;
--   -- expect all NULL until scripts/run-148.js has run.
