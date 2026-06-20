-- 111 — Taxonomy convergence: the follower v2 home reads the "one brain"
-- (follower_categories, via categoryTaxonomy.service) instead of the duplicate
-- follower_verticals I added in 110. follower_categories already holds the 5
-- active launch tiles (food/fashion/furniture/beauty/car_rental) wired to real
-- businesses; it only lacked an image column for the 3D tab images.
--
-- This migration: add image_url to follower_categories. The duplicate
-- follower_verticals is now orphaned (no code reads it after this deploy) and
-- dropped in a later cleanup. follower_vertical_categories (the "What's on your
-- mind?" dish rail — genuinely new) stays, keyed by the tile key.
--
-- Contract: features/follower-location-redesign (home convergence).

ALTER TABLE follower_categories ADD COLUMN IF NOT EXISTS image_url text;
