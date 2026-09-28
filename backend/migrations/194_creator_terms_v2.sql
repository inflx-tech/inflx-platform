-- 194_creator_terms_v2.sql
-- Contract: features/creator-terms-v2 · Docs/OFFER_TERMS_POSTS_RULES.md §2 (v1.4)
--
-- Level 2 of the offer -> terms -> posts programme: what a creator can sell in a collaboration is
-- her OFFERS (linked, not copied — collab_offers, created empty by migration 193) plus a list of
-- PRODUCTS WITHOUT OFFERS, frozen when the invitation is sent. The whole-store / category / chosen
-- products scope and the copied or special follower offer are not written for these rows.
--
-- Parts:
--   1. campaign_influencers.sell_v2           — this row's terms are the new kind (Level 2);
--      campaign_influencers.sell_mode         — none | all | chosen (what the brand picked);
--      campaign_influencers.sell_product_ids  — the products without offers, FROZEN at sending
--                                               ("all" is resolved to the list on that day);
--      campaign_influencers.withdrawn_reason  — why an invitation was withdrawn when no person
--                                               withdrew it (an ended offer left it empty, rules 2.8);
--   2. collab_offers.dropped_reason           — why a linked offer left an unsigned invitation.
--
-- ADDITIVE. No backfill: every existing collaboration keeps its old terms and is read as before.
-- MONEY: none moves. scripts/run-194.js reads it before and after.

BEGIN;

ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS sell_v2 boolean NOT NULL DEFAULT false;
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS sell_mode text;
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS sell_product_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE campaign_influencers ADD COLUMN IF NOT EXISTS withdrawn_reason text;

ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_sell_mode_known;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_sell_mode_known
  CHECK (sell_mode IS NULL OR sell_mode IN ('none', 'all', 'chosen'));

-- A new-kind row never carries the old scope or a copied offer.
ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_sell_v2_no_old_scope;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_sell_v2_no_old_scope
  CHECK (NOT sell_v2 OR (alloc_scope IS NULL AND offer_type IS NULL AND brand_offer_id IS NULL));

CREATE INDEX IF NOT EXISTS idx_ci_sell_products ON campaign_influencers USING gin (sell_product_ids) WHERE sell_v2;

ALTER TABLE collab_offers ADD COLUMN IF NOT EXISTS dropped_reason text;

COMMIT;
