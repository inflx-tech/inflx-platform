-- Migration 119 — Section engine: 'business' scope + widen shelf_type CHECK.
--
-- App Builder program, Phase 1 (Docs/ADMIN_SECTION_ENGINE.md). Two CHECK
-- widenings on section_config:
--   1. screen: add 'business' (the per-vertical business-page scope — the third
--      section stack alongside Home/world + Creator Store).
--   2. shelf_type: add 'tiles','category_rail','restaurant_list' — the presets
--      that the admin emits but the DB CHECK (mig 083) silently rejected, so
--      those sections could never be saved. (Phase 0 fixed the controller
--      allow-list; this completes it at the DB.)
--
-- Idempotent: drop-if-exists then re-add the named constraints. Additive only —
-- no existing row is touched (the new values only widen what's permitted).

ALTER TABLE section_config DROP CONSTRAINT IF EXISTS section_config_screen_check;
ALTER TABLE section_config ADD  CONSTRAINT section_config_screen_check
  CHECK (screen IN ('home','category','offers','creator_store','creator_category','business'));

ALTER TABLE section_config DROP CONSTRAINT IF EXISTS section_config_shelf_type_check;
ALTER TABLE section_config ADD  CONSTRAINT section_config_shelf_type_check
  CHECK (shelf_type IN ('creators','nav_tiles','offers','products','brands','mixed','controls',
                        'tiles','category_rail','restaurant_list'));
