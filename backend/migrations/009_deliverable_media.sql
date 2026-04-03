-- 009_deliverable_media.sql
-- Add media storage columns to deliverables table

ALTER TABLE deliverables
  ADD COLUMN IF NOT EXISTS media_key   TEXT,
  ADD COLUMN IF NOT EXISTS media_type  TEXT;
