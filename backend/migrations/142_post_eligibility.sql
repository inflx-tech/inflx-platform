-- 142_post_eligibility.sql — the live "promise" test cache (Post/Concept P4)
-- Contract: features/concept-p4-eligibility/ · POST_CONCEPT_MODEL.md §6
--
-- A post is VISIBLE while ≥1 attached product still satisfies its concept
-- (price/offer/category/tag rule ∩ still allocated ∩ still purchasable).
-- The test itself always runs LIVE (founder lock — no snapshots); these
-- columns are only a CACHE so the feed can filter cheaply:
--   eligible_product_count  NULL = never checked (treated visible), 0 = dark
--   eligibility_checked_at  when the sweep last computed it
--   went_dark_at            set on the >0→0 transition (creator notified
--                           'post.dark'); cleared if products qualify again
-- The detail endpoint always recomputes live; the sweep cron refreshes the
-- cache and fires the notifications.

BEGIN;

ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS eligible_product_count integer;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS eligibility_checked_at timestamptz;
ALTER TABLE creator_posts ADD COLUMN IF NOT EXISTS went_dark_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_creator_posts_visible
  ON creator_posts (status, created_at DESC)
  WHERE status = 'approved' AND (eligible_product_count IS NULL OR eligible_product_count > 0);

COMMIT;
