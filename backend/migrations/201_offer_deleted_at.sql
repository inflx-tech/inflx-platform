-- 201_offer_deleted_at.sql
-- Contract: features/offer-delete · Docs/OFFER_TERMS_POSTS_RULES.md §1.9 (v1.17)
--
-- The brand can delete an offer once it has ENDED (ended early with End offer now, or ended by its
-- date). Deleting it HIDES it from the brand: it leaves the Offers list and its counts, its page
-- answers "not found", and the brand's other offer hints leave it out. Its row stays, because
-- creators' signed terms (collab_offers, RESTRICT), their posts (creator_posts.offer_id, RESTRICT),
-- order lines (order_lines.offer_id / pool_item_id) and the wallet's sales still point at it and
-- still show it. A hard delete would fail on any offer a creator ever had, and would blank sale
-- history (follower_transactions.brand_offer_id is SET NULL).
--
-- Parts:
--   1. brand_offers.deleted_at — when the brand deleted the (ended) offer; NULL = shown.
--      Only the brand's own reads filter on it. Status is never changed by a delete, so every check
--      that reads status ('ended') keeps working. A DRAFT is still erased outright, as before.
--
-- No index: the brand's list is already brand-scoped through idx_brand_offers_v2
-- (brand_id, engine, status) and a brand has tens of offers, so a partial index buys nothing.
--
-- ADDITIVE. NO BACKFILL (every existing offer stays shown). Repeatable: IF NOT EXISTS.
-- MONEY: none moves. scripts/run-201.js reads the counts before and after.

BEGIN;

-- Adding the column needs the table's exclusive lock for an instant. If another session is holding
-- brand_offers open, give up after five seconds rather than wait with every offer read queued
-- behind us. (SET LOCAL: lives in this transaction only, so it also holds through the pooler.)
-- A lock timeout changes nothing; run it again.
SET LOCAL lock_timeout = '5s';

ALTER TABLE brand_offers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN brand_offers.deleted_at IS
  'offer-delete (rules v1.17 §1.9). When the brand deleted this ENDED offer: it is hidden from the brand''s lists and pages only. Creators, shoppers, orders, the wallet and INFLX still read the row. NULL = shown.';

COMMIT;
