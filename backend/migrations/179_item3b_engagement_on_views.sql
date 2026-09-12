-- 179 — Item 3b amendment (founder decision 2026-09-12): Instagram engagement is measured
-- against views, not followers, and the numbers are computed from the newest 30 posts inside
-- the 90-day window instead of every post in it.
--
-- Why: Instagram distributes reels far beyond a creator's own followers, so likes ÷ followers
-- reports absurd figures for anyone whose reels travel (the first live creator read 86%). The
-- YouTube half of this feature already divides by views; this brings Instagram in line.
-- Contract: features/item3b-social-numbers
BEGIN;

-- Which denominator produced ig_engagement: 'views' (reels, the normal case) or 'followers'
-- (fallback for a creator who posted no reels in the measured set).
ALTER TABLE creator_social_metrics ADD COLUMN IF NOT EXISTS ig_engagement_basis text
  CHECK (ig_engagement_basis IN ('views','followers'));

-- How many posts/uploads existed in the 90-day window, when only the newest 30 were measured.
ALTER TABLE creator_social_metrics ADD COLUMN IF NOT EXISTS posts_seen int;

-- Every existing metrics row was computed on the old followers-based rule over every post in
-- the window. The numbers on them are not comparable to what the new rule produces, so they are
-- retired: the next run (scheduled, or Measure now) recomputes each account under the new rule.
-- Clearing the legacy engagement column keeps brand-facing screens from showing an 86% while
-- the account waits for that run; followers/subscribers stay, they are unaffected by this change.
UPDATE creator_social_metrics SET ig_engagement = NULL, ig_engagement_basis = NULL
 WHERE ig_engagement IS NOT NULL;
UPDATE influencers SET engagement_rate = NULL WHERE engagement_rate IS NOT NULL;

COMMIT;
