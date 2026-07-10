-- Migration 132 — Design Library seed: the 10 layouts + contracts
-- (Creator Experience Engine, Phase 3. Contract: features/design-library/.)
--
-- Contracts transcribed exactly from Docs/CREATOR_EXPERIENCE_ENGINE/02_LAYOUT_CONTRACTS.md.
-- Seeded GLOBAL (world_key NULL) — reusable across worlds.
-- Idempotent: ON CONFLICT (key) DO UPDATE re-seeds.

INSERT INTO design_layouts (key, label, kind, aspect_hint, contract_json, sort_order) VALUES
  ('hero_banner','Hero Banner','banner','16:9',
   '{"required":["background","featured_image","title"],"optional":["subtitle","cta","offer_badge","avatar","creator_name"],"hidden":["products","price"]}',1),
  ('split_banner','Split Banner','banner','2x1:1',
   '{"required":["featured_image","title"],"optional":["subtitle","offer_badge","avatar"],"hidden":["cta","products","price"]}',2),
  ('medium_card','Medium Card','card','4:5',
   '{"required":["featured_image","title"],"optional":["avatar","creator_name","offer_badge"],"hidden":["subtitle","cta","products"]}',3),
  ('small_tile','Small Tile','card','1:1',
   '{"required":["featured_image","title"],"optional":["avatar"],"hidden":["subtitle","cta","offer_badge","products","price"]}',4),
  ('story_card','Story Card','card','9:16',
   '{"required":["featured_image","avatar"],"optional":["title","offer_badge"],"hidden":["subtitle","cta","products","price"]}',5),
  ('magazine_card','Magazine Card','card','4:5',
   '{"required":["background","featured_image","title"],"optional":["subtitle","creator_name","avatar"],"hidden":["offer_badge","products"]}',6),
  ('product_shelf_header','Product Shelf Header','structure','flex',
   '{"required":["title"],"optional":["avatar","creator_name","offer_badge"],"hidden":["featured_image","subtitle","cta"]}',7),
  ('category_mosaic_tile','Category Mosaic Tile','card','1:1',
   '{"required":["featured_image","title"],"optional":["offer_badge"],"hidden":["subtitle","cta","avatar","products"]}',8),
  ('horizontal_carousel_card','Horizontal Carousel Card','card','3:4',
   '{"required":["featured_image","title"],"optional":["offer_badge","price"],"hidden":["subtitle","cta","avatar"]}',9),
  ('bento_tile','Bento Tile','card','flex',
   '{"required":["featured_image"],"optional":["title"],"hidden":["subtitle","cta","avatar","offer_badge","products"]}',10)
ON CONFLICT (key) DO UPDATE SET
  label=EXCLUDED.label, kind=EXCLUDED.kind, aspect_hint=EXCLUDED.aspect_hint,
  contract_json=EXCLUDED.contract_json, sort_order=EXCLUDED.sort_order, updated_at=now();
