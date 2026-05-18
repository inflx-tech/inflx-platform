-- 053_restaurant_reviews.sql
-- Wave 5 — restaurant reviews + ratings.
--
-- A review is tied to a qualifying follower_transactions row (the visit /
-- booking / order that earns the right to review). Reviews authored by a
-- user who also has an influencer profile are flagged is_creator_review
-- so the follower app can offer the "creator-verified reviews" trust
-- filter (the INFLX moat layer).
--
-- campaign_influencer_id is the attribution trail: when the reviewing
-- follower arrived via a creator's tracking link, we keep that link so
-- "creator-trusted" surfacing can also count creator-influenced reviews,
-- not only reviews physically authored by a creator.
--
-- Additive only. No existing table altered.

CREATE TABLE IF NOT EXISTS restaurant_reviews (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id               uuid NOT NULL REFERENCES brands(id),
  follower_id            uuid REFERENCES followers(id),
  influencer_id          uuid REFERENCES influencers(id),
  transaction_id         uuid REFERENCES follower_transactions(id),
  campaign_influencer_id uuid REFERENCES campaign_influencers(id),
  rating                 int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text            text,
  photos                 jsonb DEFAULT '[]'::jsonb,
  is_creator_review      boolean DEFAULT false,
  status                 varchar(20) DEFAULT 'published',  -- published | hidden (moderation hook)
  created_at             timestamptz DEFAULT now()
);

-- One review per qualifying transaction (prevents a follower spamming the
-- same visit). NULL transaction_id rows (e.g. seeded creator reviews) are
-- exempt from the uniqueness constraint via the partial index.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_per_txn
  ON restaurant_reviews (transaction_id)
  WHERE transaction_id IS NOT NULL;

-- Aggregate lookups (avg + count per brand) and the creator-only filter.
CREATE INDEX IF NOT EXISTS idx_reviews_brand
  ON restaurant_reviews (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_brand_creator
  ON restaurant_reviews (brand_id, is_creator_review)
  WHERE status = 'published';

COMMENT ON TABLE  restaurant_reviews IS 'Wave 5 — follower/creator reviews tied to a qualifying follower_transactions visit.';
COMMENT ON COLUMN restaurant_reviews.is_creator_review      IS 'TRUE when the review author also has an influencers row — drives the creator-verified filter.';
COMMENT ON COLUMN restaurant_reviews.campaign_influencer_id IS 'Attribution trail: the creator whose link brought this follower, if any. Lets "creator-trusted" also count creator-influenced reviews.';
COMMENT ON COLUMN restaurant_reviews.status                 IS 'published | hidden. Moderation hook — only published rows count toward aggregates + listings.';
