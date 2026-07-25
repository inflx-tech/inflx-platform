-- 143_follower_wishlist.sql — product Wishlist + collections (Stage C2)
-- Contract: features/concept-stagec2-bag-wishlist/
--
-- Wishlist stores POINTERS only (follower × product) — cards always render
-- from live brand_products data, so dead/out-of-stock items grey out honestly
-- instead of showing stale copies (board rule). Collections are follower-
-- private named groups; one item can sit in many collections. Guests keep a
-- device-local wishlist that syncs into these tables at the one login moment
-- (follower-guest-first law).

BEGIN;

CREATE TABLE IF NOT EXISTS follower_wishlist_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES brand_products(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_fwi_follower ON follower_wishlist_items(follower_id);

CREATE TABLE IF NOT EXISTS follower_wishlist_collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, name)
);

CREATE TABLE IF NOT EXISTS follower_wishlist_collection_items (
  collection_id uuid NOT NULL REFERENCES follower_wishlist_collections(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES follower_wishlist_items(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, item_id)
);

COMMIT;
