-- Migration 135 — creator_experiences + experience_products
-- (Creator Experience Engine Phase 6a. Contract: features/creator-experiences/. Decision D1.)
--
-- A creator turns a placed Template (P5) into a live Experience: template +
-- products + a featured image. Publishing fills the P5 'experience_template'
-- rule so the placed template renders on the follower home (via the Adaptive
-- Renderer, P4). NEW tables (reuse the lookbook pattern); creator_lookbooks
-- stays a separate lightweight surface. v1 uses a single featured_image_url
-- (the full multi-image Asset Pack is Phase 7).
--
-- Additive + idempotent. Ships EMPTY. Deploy-inert until a creator publishes
-- for a PLACED template — until then the follower home is unchanged.

CREATE TABLE IF NOT EXISTS creator_experiences (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id      uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  world_key          text NOT NULL,                              -- denorm from the template
  template_key       text NOT NULL,                              -- experience_templates.key
  theme_key          text,                                       -- denorm from the template
  brand_id           uuid REFERENCES brands(id),                 -- primary brand (nullable; multi-brand via products)
  featured_image_url text,                                       -- v1 (upload or a product image); Asset Pack = P7
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  source_proposal_id uuid REFERENCES influencer_proposals(id) ON DELETE SET NULL,  -- if born from a scoped proposal (P8)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_experiences_influencer
  ON creator_experiences (influencer_id, status);
-- the hot path the rule uses: published experiences for a template in a world
CREATE INDEX IF NOT EXISTS idx_creator_experiences_template
  ON creator_experiences (world_key, template_key) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS experience_products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id  uuid NOT NULL REFERENCES creator_experiences(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES brand_products(id),
  variant_id     uuid REFERENCES product_variants(id),
  display_order  int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experience_products_experience
  ON experience_products (experience_id, display_order);

COMMENT ON TABLE creator_experiences IS
  'Creator Experiences (mig 135): a creator instantiates a placed Template. Published rows fill the experience_template rule → render on the follower home. v1 featured_image_url; Asset Pack = Phase 7.';
