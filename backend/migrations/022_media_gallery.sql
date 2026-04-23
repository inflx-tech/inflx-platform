-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022 — Brand Media Gallery
--
-- Adds brand_media_assets table to back the Media Gallery feature. Brands
-- upload reusable assets (logos, brand kits, videos, product shots) to R2
-- and reference them during campaign creation. Contract PDFs are NOT stored
-- here — those continue to be read from the contracts table by the gallery
-- UI via the existing /contracts/:id/pdf-url endpoint.
--
-- Idempotent: uses IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS brand_media_assets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  file_r2_key      TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  file_type        TEXT NOT NULL,
  file_size_bytes  BIGINT NOT NULL,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_media_assets_brand
  ON brand_media_assets(brand_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_media_assets_tags
  ON brand_media_assets USING GIN (tags);

COMMIT;
