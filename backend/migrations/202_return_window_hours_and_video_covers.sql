-- 202 — shopper-walk-fixes (features/shopper-walk-fixes · 01-spec.md W11, W13, W15)
--
-- 1 · The return window is ONE platform number, and INFLX's admin may set it in hours or in days
--     (founder, 4 Oct 2026: "as an admin we can set any number of days even 24hrs or any hours to
--     days as a return window"). It is kept in HOURS. The old days column stays and is kept in step
--     (rounded up), so nothing that still reads days breaks. The per-category number is no longer
--     read by any code; its column is left alone.
-- 2 · A picture taken from a video (made on the creator's phone when she uploads it), for a
--     shoppable post's video and for a file she shares with the brand.
--
-- ADDITIVE and idempotent. No sale, agreement or wallet is touched: a sale already made keeps the
-- window stamped on it (follower_transactions.return_window_ends_at).
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE payment_config ADD COLUMN IF NOT EXISTS return_window_hours integer;
UPDATE payment_config SET return_window_hours = return_window_days * 24 WHERE return_window_hours IS NULL;
ALTER TABLE payment_config ALTER COLUMN return_window_hours SET DEFAULT 168;
ALTER TABLE payment_config ALTER COLUMN return_window_hours SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_config_return_window_hours_chk') THEN
    ALTER TABLE payment_config
      ADD CONSTRAINT payment_config_return_window_hours_chk CHECK (return_window_hours BETWEEN 1 AND 8760);
  END IF;
END $$;
COMMENT ON COLUMN payment_config.return_window_hours IS
  'The return window, in hours — the one platform number (Admin › Money › Settings). After DELIVERY a sale''s three shares wait this long; a shopper may ask to return within it. return_window_days is kept in step (rounded up) for old readers.';

ALTER TABLE post_media    ADD COLUMN IF NOT EXISTS cover_r2_key text;
ALTER TABLE content_files ADD COLUMN IF NOT EXISTS cover_key    text;
COMMENT ON COLUMN post_media.cover_r2_key IS 'A still picture taken from this video on the creator''s phone at upload. NULL for photos and for videos uploaded before 4 Oct 2026.';
COMMENT ON COLUMN content_files.cover_key IS 'A still picture taken from this video on the creator''s phone at upload. NULL for photos and older videos.';

COMMIT;
