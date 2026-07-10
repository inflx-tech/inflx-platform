-- Migration 128 — Design System seed: Fashion starter catalog
-- (Creator Experience Engine, Phase 1. Contract: features/design-system-tokens/.)
--
-- Seeds the curated vocabulary per Docs/CREATOR_EXPERIENCE_ENGINE/03_TOKEN_CATALOG.md.
-- Tokens seed as GLOBAL (world_key = NULL) — reusable across worlds. Presets
-- seed as world_key='fashion' to demonstrate world scoping.
--
-- Backgrounds carry avg_color + text_safe_zone now; the actual R2 asset files
-- are the one-time design workstream (asset_r2_key = null until produced).
--
-- Idempotent: ON CONFLICT updates label/config so re-running re-seeds values.

-- ── Moods ────────────────────────────────────────────────────────────────────
INSERT INTO design_tokens (kind, key, label, world_key, config_json, sort_order) VALUES
  ('mood','urban','Urban',NULL,'{"descriptor":"street, bold","default_palette":"urban_dark","default_typography":"bold_fashion"}',1),
  ('mood','luxury','Luxury',NULL,'{"descriptor":"premium, refined","default_palette":"luxury_mono","default_typography":"luxury_serif"}',2),
  ('mood','minimal','Minimal',NULL,'{"descriptor":"clean, editorial","default_palette":"minimal_white","default_typography":"minimal_sans"}',3),
  ('mood','bright','Bright',NULL,'{"descriptor":"playful, vivid","default_palette":"summer_warm","default_typography":"modern"}',4),
  ('mood','vintage','Vintage',NULL,'{"descriptor":"retro, warm","default_palette":"earthy","default_typography":"editorial"}',5),
  ('mood','festival','Festival',NULL,'{"descriptor":"celebratory","default_palette":"night","default_typography":"bold_fashion"}',6),
  ('mood','nature','Nature',NULL,'{"descriptor":"organic, calm","default_palette":"earthy","default_typography":"editorial"}',7),
  ('mood','sports','Sports',NULL,'{"descriptor":"active, energetic","default_palette":"urban_dark","default_typography":"sporty"}',8)
ON CONFLICT (kind, key) DO UPDATE SET label=EXCLUDED.label, config_json=EXCLUDED.config_json, sort_order=EXCLUDED.sort_order, updated_at=now();

-- ── Palettes ─────────────────────────────────────────────────────────────────
INSERT INTO design_tokens (kind, key, label, world_key, config_json, sort_order) VALUES
  ('palette','urban_dark','Urban Dark',NULL,'{"primary":"#26262A","secondary":"#5F5E5A","accent":"#FFC400","bg":"#1C1C1E","text":"#FFFFFF"}',1),
  ('palette','minimal_white','Minimal White',NULL,'{"primary":"#FFFFFF","secondary":"#F1EFE8","accent":"#1A1A1A","bg":"#FFFFFF","text":"#1A1A1A"}',2),
  ('palette','summer_warm','Summer Warm',NULL,'{"primary":"#D85A30","secondary":"#F0997B","accent":"#378ADD","bg":"#FAECE7","text":"#4A1B0C"}',3),
  ('palette','luxury_mono','Luxury Mono',NULL,'{"primary":"#1A1A1A","secondary":"#888780","accent":"#C9A24B","bg":"#F1EFE8","text":"#1A1A1A"}',4),
  ('palette','earthy','Earthy',NULL,'{"primary":"#5F5E5A","secondary":"#9FE1CB","accent":"#1D9E75","bg":"#E1F5EE","text":"#04342C"}',5),
  ('palette','night','Night',NULL,'{"primary":"#26215C","secondary":"#534AB7","accent":"#AFA9EC","bg":"#1C1C24","text":"#EEEDFE"}',6)
ON CONFLICT (kind, key) DO UPDATE SET label=EXCLUDED.label, config_json=EXCLUDED.config_json, sort_order=EXCLUDED.sort_order, updated_at=now();

-- ── Typography ───────────────────────────────────────────────────────────────
INSERT INTO design_tokens (kind, key, label, world_key, config_json, sort_order) VALUES
  ('typography','bold_fashion','Bold Fashion',NULL,'{"family":"Inter","weight":800,"spacing":"-0.02em"}',1),
  ('typography','luxury_serif','Luxury Serif',NULL,'{"family":"serif","weight":600,"spacing":"0"}',2),
  ('typography','minimal_sans','Minimal Sans',NULL,'{"family":"Inter","weight":500,"spacing":"0"}',3),
  ('typography','editorial','Editorial',NULL,'{"family":"Inter","weight":700,"spacing":"-0.01em","scale":"large"}',4),
  ('typography','modern','Modern',NULL,'{"family":"Inter","weight":600,"spacing":"0.01em"}',5),
  ('typography','sporty','Sporty',NULL,'{"family":"Inter","weight":800,"spacing":"0.02em","transform":"uppercase"}',6)
ON CONFLICT (kind, key) DO UPDATE SET label=EXCLUDED.label, config_json=EXCLUDED.config_json, sort_order=EXCLUDED.sort_order, updated_at=now();

-- ── Backgrounds (curated library; asset_r2_key null until produced) ──────────
INSERT INTO design_tokens (kind, key, label, world_key, config_json, sort_order) VALUES
  ('background','urban_concrete','Urban Concrete',NULL,'{"type":"texture","avg_color":"#3a3a3d","asset_r2_key":null,"text_safe_zone":"bottom-left"}',1),
  ('background','studio_wall','Studio Wall',NULL,'{"type":"texture","avg_color":"#d8d5cd","asset_r2_key":null,"text_safe_zone":"bottom-left"}',2),
  ('background','soft_blur','Soft Blur',NULL,'{"type":"texture","avg_color":"#c9c9cf","asset_r2_key":null,"text_safe_zone":"center"}',3),
  ('background','flat_gradient','Flat Gradient',NULL,'{"type":"gradient","avg_color":"#4a4a55","asset_r2_key":null,"text_safe_zone":"bottom-left"}',4),
  ('background','cafe','Cafe',NULL,'{"type":"texture","avg_color":"#6b5642","asset_r2_key":null,"text_safe_zone":"bottom-left"}',5),
  ('background','minimal_paper','Minimal Paper',NULL,'{"type":"flat","avg_color":"#eae7df","asset_r2_key":null,"text_safe_zone":"bottom-left"}',6),
  ('background','street_wall','Street Wall',NULL,'{"type":"texture","avg_color":"#4d4a45","asset_r2_key":null,"text_safe_zone":"bottom-left"}',7),
  ('background','outdoor','Outdoor',NULL,'{"type":"texture","avg_color":"#7d8a6f","asset_r2_key":null,"text_safe_zone":"bottom-left"}',8),
  ('background','luxury_marble','Luxury Marble',NULL,'{"type":"texture","avg_color":"#c9a24b","asset_r2_key":null,"text_safe_zone":"bottom-left"}',9),
  ('background','yellow_gradient','Yellow Gradient',NULL,'{"type":"gradient","avg_color":"#F5C518","asset_r2_key":null,"text_safe_zone":"bottom-left"}',10),
  ('background','green_nature','Green Nature',NULL,'{"type":"texture","avg_color":"#1d9e75","asset_r2_key":null,"text_safe_zone":"bottom-left"}',11),
  ('background','festival_lights','Festival Lights',NULL,'{"type":"texture","avg_color":"#26215c","asset_r2_key":null,"text_safe_zone":"center"}',12),
  ('background','travel_sky','Travel Sky',NULL,'{"type":"gradient","avg_color":"#85b7eb","asset_r2_key":null,"text_safe_zone":"bottom-left"}',13),
  ('background','beach','Beach',NULL,'{"type":"texture","avg_color":"#e6d3a8","asset_r2_key":null,"text_safe_zone":"bottom-left"}',14),
  ('background','fabric','Fabric',NULL,'{"type":"texture","avg_color":"#8a8078","asset_r2_key":null,"text_safe_zone":"bottom-left"}',15),
  ('background','denim','Denim',NULL,'{"type":"texture","avg_color":"#3f5a78","asset_r2_key":null,"text_safe_zone":"bottom-left"}',16)
ON CONFLICT (kind, key) DO UPDATE SET label=EXCLUDED.label, config_json=EXCLUDED.config_json, sort_order=EXCLUDED.sort_order, updated_at=now();

-- ── Radius & Shadow ──────────────────────────────────────────────────────────
INSERT INTO design_tokens (kind, key, label, world_key, config_json, sort_order) VALUES
  ('radius','sharp','Sharp',NULL,'{"px":4}',1),
  ('radius','soft','Soft',NULL,'{"px":12}',2),
  ('radius','round','Round',NULL,'{"px":20}',3),
  ('shadow','none','None',NULL,'{"level":"none"}',1),
  ('shadow','soft','Soft',NULL,'{"level":"soft"}',2),
  ('shadow','elevated','Elevated',NULL,'{"level":"elevated"}',3)
ON CONFLICT (kind, key) DO UPDATE SET label=EXCLUDED.label, config_json=EXCLUDED.config_json, sort_order=EXCLUDED.sort_order, updated_at=now();

-- ── Presets (Fashion) ────────────────────────────────────────────────────────
INSERT INTO design_presets (key, label, world_key, tokens_json, positions_json) VALUES
  ('urban_fashion','Urban Fashion','fashion','{"mood":"urban","palette":"urban_dark","typography":"bold_fashion","background":"urban_concrete","radius":"soft","shadow":"soft"}','{"avatar":"top-left","featured":"right","cta":"bottom-left"}'),
  ('luxury_editorial','Luxury Editorial','fashion','{"mood":"luxury","palette":"luxury_mono","typography":"luxury_serif","background":"luxury_marble","radius":"soft","shadow":"elevated"}','{"avatar":"top-left","featured":"right","cta":"bottom-right"}'),
  ('summer_collection','Summer Collection','fashion','{"mood":"bright","palette":"summer_warm","typography":"modern","background":"yellow_gradient","radius":"round","shadow":"soft"}','{"avatar":"top-left","featured":"right","cta":"bottom-left"}'),
  ('travel_lifestyle','Travel Lifestyle','fashion','{"mood":"nature","palette":"earthy","typography":"editorial","background":"travel_sky","radius":"soft","shadow":"soft"}','{"avatar":"top-left","featured":"right","cta":"bottom-left"}'),
  ('minimal_fashion','Minimal Fashion','fashion','{"mood":"minimal","palette":"minimal_white","typography":"minimal_sans","background":"minimal_paper","radius":"sharp","shadow":"none"}','{"avatar":"top-left","featured":"right","cta":"bottom-left"}'),
  ('sports_active','Sports Active','fashion','{"mood":"sports","palette":"urban_dark","typography":"sporty","background":"studio_wall","radius":"soft","shadow":"soft"}','{"avatar":"top-left","featured":"right","cta":"bottom-left"}'),
  ('festive_collection','Festive Collection','fashion','{"mood":"festival","palette":"night","typography":"bold_fashion","background":"festival_lights","radius":"round","shadow":"elevated"}','{"avatar":"top-left","featured":"center","cta":"bottom-left"}'),
  ('premium_boutique','Premium Boutique','fashion','{"mood":"luxury","palette":"luxury_mono","typography":"luxury_serif","background":"fabric","radius":"soft","shadow":"elevated"}','{"avatar":"top-left","featured":"right","cta":"bottom-right"}')
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, world_key=EXCLUDED.world_key, tokens_json=EXCLUDED.tokens_json, positions_json=EXCLUDED.positions_json, updated_at=now();
