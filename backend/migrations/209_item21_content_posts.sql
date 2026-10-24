-- 209 — item 21: Pay for Content gains shoppable posts; Entire store allocation for every Aim.
-- Contract: features/item21-content-posts · master rules v1.34 §7A, §12.2, §19, §21, §22, §25
--
-- ADDITIVE. No existing row is written.
--   1. campaign_influencers.shoppable_posts_n — the number the BRAND set on a Pay for Content
--      invitation (1–10, countered like deliverables). NULL on every row today: Pay for Sale and
--      Hybrid keep the admin minimum in min_shoppable_posts; an old-terms Pay for Content
--      collaboration has no posts at all (sell_v2 = false).
--   2. sell_mode gains 'store' — the Entire store: every offer and every product without an offer,
--      read LIVE (new ones join after signing). sell_product_ids stays empty for it.
--   3. collab_content.brand_report_kind gains 'posts_not_made' (the brand, after the posting date).
--   4. escrow_entries.release_held_for_posts — the job records WHY a due final 50% did not release.
--   5. The Delayed CHECK already holds 'posts_not_approved' (migration 199); nothing to widen.

BEGIN;

ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS shoppable_posts_n smallint;
ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_shoppable_posts_n_range;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_shoppable_posts_n_range
  CHECK (shoppable_posts_n IS NULL OR shoppable_posts_n BETWEEN 1 AND 10);
COMMENT ON COLUMN campaign_influencers.shoppable_posts_n IS
  'Item 21 (v1.34). Pay for Content only: how many shoppable posts the brand asked for (1–10), countered like deliverables, frozen at signing. NULL = not a posts-bearing Pay for Content collaboration.';

ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_sell_mode_known;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_sell_mode_known
  CHECK (sell_mode IS NULL OR sell_mode IN ('none', 'all', 'chosen', 'store'));
COMMENT ON COLUMN campaign_influencers.sell_mode IS
  'none | all | chosen (products without offers, frozen in sell_product_ids) | store (item 21: the Entire store — every offer and every product without an offer, read live; no collab_offers rows, sell_product_ids empty).';

ALTER TABLE collab_content DROP CONSTRAINT IF EXISTS collab_content_brand_report_kind_check;
ALTER TABLE collab_content ADD CONSTRAINT collab_content_brand_report_kind_check
  CHECK (brand_report_kind IN ('rounds_used','posted_wrong','not_posted','missing','posts_not_made'));

ALTER TABLE escrow_entries ADD COLUMN IF NOT EXISTS release_held_for_posts boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN escrow_entries.release_held_for_posts IS
  'Item 21. A queued final 50% whose date has passed but whose collaboration is still short of its agreed shoppable posts. Cleared when it releases.';

COMMIT;
