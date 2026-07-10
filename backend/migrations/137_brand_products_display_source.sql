-- Migration 137 — brand_products.display_image_source_influencer_id
-- (Creator Experience Engine Phase 7a. Contract: features/creator-imagery/.)
--
-- The brand's choice of WHOSE approved photo shows for a product in its OWN
-- store. NULL = the brand's own catalog image (today's behavior — every
-- existing row). Set = show this creator's approved shot (the brand-context
-- resolver also verifies the creator is still contracted → collab-end
-- auto-withdraws to the own image). Creator's own store always shows own shots.
--
-- Additive + idempotent. Every existing product row keeps NULL (unchanged).

ALTER TABLE brand_products
  ADD COLUMN IF NOT EXISTS display_image_source_influencer_id uuid REFERENCES influencers(id);

COMMENT ON COLUMN brand_products.display_image_source_influencer_id IS
  'Brand''s chosen image source for its own store (mig 137). NULL = brand catalog image (default/today). Set = this creator''s approved shot (resolver checks still-contracted → auto-withdraw on collab end). FLAG-GATED via CREATOR_IMAGERY.';
