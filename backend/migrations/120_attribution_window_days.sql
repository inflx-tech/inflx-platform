-- 120: admin-configurable creator attribution window (follower-creator-attribution
-- Slice 5 Part 3 / Way-4). The attribution_clicks "cookie" window was hardcoded
-- to 30 days; this makes the duration an admin-editable value on the singleton
-- payment_config row (e.g. 30 / 15 / 1 day). Additive — no row altered. Safe to
-- re-run.
ALTER TABLE payment_config
  ADD COLUMN IF NOT EXISTS attribution_window_days integer NOT NULL DEFAULT 30;
