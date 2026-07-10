-- Migration 138 — scoped, theme-aware proposals
-- (Creator Experience Engine Phase 8a. Contract: features/scoped-proposals/.)
--
-- Extends the live Phase-Q proposals (mig 025): a creator can propose at
-- store/category/product scope tied to a Theme. On brand accept, an experience
-- draft is seeded (best-effort) — which may not yet have a template, so we
-- loosen creator_experiences.template_key to nullable (proposal-seeded drafts
-- are completed in the Studio).
--
-- Additive + idempotent. Every existing proposal row keeps NULLs → an unscoped
-- proposal behaves exactly as today.

ALTER TABLE influencer_proposals
  ADD COLUMN IF NOT EXISTS scope_level          text,   -- 'store' | 'category' | 'product'
  ADD COLUMN IF NOT EXISTS scope_ref_json       jsonb,  -- { category_node_id } | { product_ids:[…] }
  ADD COLUMN IF NOT EXISTS theme_key            text,   -- proposed experience theme
  ADD COLUMN IF NOT EXISTS proposed_product_ids jsonb;  -- array of brand_products ids

-- Proposal-seeded experience drafts may not have a template yet.
ALTER TABLE creator_experiences ALTER COLUMN template_key DROP NOT NULL;

COMMENT ON COLUMN influencer_proposals.scope_level IS
  'Creator Experience Engine Phase 8: store/category/product scope of the pitch (NULL = unscoped, today''s behavior).';
