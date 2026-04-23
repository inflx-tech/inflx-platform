-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 023 — Gallery storage quota + reference links
--
-- 1. brands.storage_quota_bytes — per-brand upload cap (default 500 MB).
--    Admin can bump this for enterprise accounts by updating the column.
-- 2. brand_reference_links — URLs (YouTube, Drive, Figma, Notion, etc.) the
--    brand wants to keep alongside uploaded assets. Zero storage cost —
--    we only keep the URL metadata, not the file.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT NOT NULL DEFAULT 524288000;
  -- 524288000 = 500 * 1024 * 1024

CREATE TABLE IF NOT EXISTS brand_reference_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_reference_links_brand
  ON brand_reference_links(brand_id, created_at DESC);

COMMIT;
