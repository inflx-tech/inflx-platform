-- 145_discover_layouts.sql — the ONE Discover layout (Stage B2)
-- Contract: features/concept-stageb-discover/
--
-- One row per scope:
--   'global'   — the Discover tab (admin-curated)
--   'business' — the single structure applied to EVERY brand page
--                (rows auto-hide per brand when empty — never per-brand rows)
--   'creator'  — one row PER creator (creator_id set) for their My Store
--                arranger; global/business rows have creator_id NULL.
-- rows_json is the ordered row list; the follower resolver interprets it
-- against LIVE data (concept counts, eligibility, rules) at read time — the
-- layout stores intent, never content.

BEGIN;

CREATE TABLE IF NOT EXISTS discover_layouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       text NOT NULL CHECK (scope IN ('global','business','creator')),
  creator_id  uuid REFERENCES influencers(id) ON DELETE CASCADE,
  rows_json   jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discover_creator_scope CHECK ((scope = 'creator') = (creator_id IS NOT NULL))
);

-- exactly one global + one business layout; one per creator
CREATE UNIQUE INDEX IF NOT EXISTS idx_discover_singleton
  ON discover_layouts(scope) WHERE creator_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_discover_creator
  ON discover_layouts(creator_id) WHERE creator_id IS NOT NULL;

COMMIT;
