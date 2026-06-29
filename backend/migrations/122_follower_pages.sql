-- Migration 122 — Follower custom pages (App Builder: admin-created pages).
--
-- Contract: features/follower-page-builder/ (D tap-destination chooser + E pages).
-- Two additive changes:
--   1. New table follower_pages — the page REGISTRY (metadata only). A page's
--      sections live in section_config under screen='page', scope_type='vertical',
--      scope_value=<page key> — fully reusing the existing engine + composer.
--   2. Widen section_config.screen CHECK to add 'page' (additive — existing six
--      scopes untouched).
--
-- Idempotent + additive: CREATE TABLE IF NOT EXISTS, drop-if-exists/re-add the
-- named CHECK. No existing row is altered. Safe to re-run.

CREATE TABLE IF NOT EXISTS follower_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,        -- slug, e.g. 'summer_sale' (the section_config scope_value)
  label       text NOT NULL,               -- admin-facing name, e.g. "Summer Sale"
  title       text,                         -- follower-facing hero title (optional)
  subtitle    text,                         -- follower-facing subtitle (optional)
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE section_config DROP CONSTRAINT IF EXISTS section_config_screen_check;
ALTER TABLE section_config ADD  CONSTRAINT section_config_screen_check
  CHECK (screen IN ('home','category','offers','creator_store','creator_category','business','page'));
