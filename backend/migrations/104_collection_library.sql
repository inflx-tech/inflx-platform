-- ============================================================================
-- Migration 104 — Collection Library (Phase 4a)
--   (contract: features/merch-engine-p4a-collections-engine)
-- ----------------------------------------------------------------------------
-- A Collection = a named, ordered GROUP of Section-Library sections (Layer 5).
-- e.g. "Summer Collection" = [Summer Dresses, Summer Footwear, Summer Bags].
-- When placed on a screen, the engine renders a titled header + each member
-- section as a shelf (context-stacked, reusing the Phase-3 evaluator).
--
-- Additive + DORMANT: nothing renders until a collection is built (4b) + placed.
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS collection_library (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type text,                                  -- optional admin grouping ('ALL'/null = mixed)
  name          text NOT NULL,                         -- e.g. "Summer Collection"
  image_url     text,                                  -- optional header banner
  section_ids   uuid[] NOT NULL DEFAULT '{}'::uuid[],  -- ordered section_library ids (members)
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_library_status
  ON collection_library (status, business_type);

COMMIT;
