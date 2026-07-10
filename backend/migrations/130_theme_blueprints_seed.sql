-- Migration 130 — Theme Blueprints seed (Fashion)
-- (Creator Experience Engine, Phase 2. Contract: features/theme-library/.)
--
-- ~21 seeded starter themes (is_blueprint=true), grouped by purpose. "Create
-- Theme" clones a blueprint's fields into a draft; the admin edits the delta.
-- supported_categories are curated labels (mapped to real category nodes when
-- the creator Experience Studio consumes them in Phase 6). Each references a
-- Phase-1 design_preset for its visual identity.
--
-- Idempotent: ON CONFLICT (world_key,key,is_blueprint) DO UPDATE re-seeds.

INSERT INTO experience_themes
  (world_key, key, name, subtitle, icon, description, purpose, audience, preset_key,
   supported_categories, min_products, max_products, supported_offer_types,
   default_title, default_subtitle, default_cta, applicable_worlds, is_blueprint)
VALUES
  -- ── Lifestyle ──────────────────────────────────────────────────────────────
  ('fashion','street_style','Street Style','Urban looks curated for everyday confidence.','👟','Urban casual looks curated by creators.','lifestyle','unisex','urban_fashion',
   '["Jeans","Cargo","Sneakers","T-shirts","Jackets","Caps"]',4,20,'{discount,bundle,bogo,free_gift}',
   'Street Style','Urban looks curated for everyday confidence.','Explore collection','{fashion}',true),
  ('fashion','minimal','Minimal','Clean fits, timeless style.','🤍','Minimal, understated everyday fashion.','lifestyle','unisex','minimal_fashion',
   '["Shirts","Trousers","Sneakers","Knitwear"]',4,20,'{discount,bundle}',
   'Minimal','Clean fits, timeless style.','Shop the edit','{fashion}',true),
  ('fashion','old_money','Old Money','Quiet luxury, understated elegance.','🎩','Refined heritage-inspired fashion.','lifestyle','unisex','luxury_editorial',
   '["Blazers","Loafers","Knitwear","Trousers","Watches"]',4,18,'{bundle,free_gift}',
   'Old Money','Quiet luxury, understated elegance.','Explore','{fashion}',true),
  ('fashion','boho','Boho','Free-spirited, layered and easy.','🌿','Bohemian, relaxed layered looks.','lifestyle','women','travel_lifestyle',
   '["Dresses","Skirts","Accessories","Sandals"]',4,20,'{discount,bogo}',
   'Boho','Free-spirited, layered and easy.','Explore collection','{fashion}',true),
  -- ── Occasion ───────────────────────────────────────────────────────────────
  ('fashion','wedding','Wedding Collection','Occasion looks for the big day.','💍','Wedding and celebration wear.','occasion','women','luxury_editorial',
   '["Sarees","Lehenga","Sherwani","Juttis","Jewellery"]',6,24,'{free_gift,bundle}',
   'Wedding Collection','Occasion looks for the big day.','Shop the collection','{fashion}',true),
  ('fashion','office','Office Essentials','Sharp looks for the workday.','💼','Workwear and office essentials.','occasion','unisex','minimal_fashion',
   '["Shirts","Trousers","Blazers","Formal shoes"]',4,20,'{discount,bundle}',
   'Office Essentials','Sharp looks for the workday.','Shop workwear','{fashion}',true),
  ('fashion','date_night','Date Night','Looks that turn heads after dark.','🌙','Evening and date-night outfits.','occasion','unisex','festive_collection',
   '["Dresses","Heels","Shirts","Accessories"]',4,16,'{discount,free_gift}',
   'Date Night','Looks that turn heads after dark.','Explore','{fashion}',true),
  ('fashion','festival','Festival Collection','Celebrate in colour.','🎉','Festive ethnic and fusion wear.','occasion','unisex','festive_collection',
   '["Kurtas","Sarees","Sherwani","Juttis","Accessories"]',4,24,'{discount,bundle,free_gift}',
   'Festival Collection','Celebrate in colour.','Shop festive','{fashion}',true),
  -- ── Travel ─────────────────────────────────────────────────────────────────
  ('fashion','airport_looks','Airport Looks','Travel-ready fashion for every journey.','✈️','Comfortable, put-together travel looks.','travel','unisex','travel_lifestyle',
   '["Travel bags","Sneakers","Joggers","Hoodies","Luggage"]',4,15,'{discount,bundle}',
   'Airport Looks','Travel-ready fashion for every journey.','Explore','{fashion}',true),
  ('fashion','vacation','Vacation Edit','Sun, sand and effortless style.','🏖️','Holiday and resort wear.','travel','unisex','summer_collection',
   '["Shorts","Shirts","Swimwear","Sandals","Sunglasses"]',4,20,'{discount,bogo}',
   'Vacation Edit','Sun, sand and effortless style.','Shop the edit','{fashion}',true),
  ('fashion','weekend_trip','Weekend Trip','Pack light, look sharp.','🎒','Casual weekend-getaway outfits.','travel','unisex','travel_lifestyle',
   '["T-shirts","Denim","Sneakers","Backpacks"]',4,16,'{discount,bundle}',
   'Weekend Trip','Pack light, look sharp.','Explore','{fashion}',true),
  -- ── Budget ─────────────────────────────────────────────────────────────────
  ('fashion','under_499','Under ₹499','Great style, tiny price.','🏷️','Budget picks under ₹499.','budget','unisex','urban_fashion',
   '["T-shirts","Accessories","Caps","Socks"]',3,30,'{discount}',
   'Under ₹499','Great style, tiny price.','Shop under ₹499','{fashion}',true),
  ('fashion','under_999','Under ₹999','Style that fits every budget.','🏷️','Budget picks under ₹999.','budget','unisex','urban_fashion',
   '["Jeans","T-shirts","Sneakers","Shirts"]',3,30,'{discount,bogo}',
   'Under ₹999','Style that fits every budget.','Shop under ₹999','{fashion}',true),
  ('fashion','premium_picks','Premium Picks','Elevated pieces worth the splurge.','💎','Premium and boutique selections.','budget','unisex','premium_boutique',
   '["Blazers","Leather","Watches","Loafers"]',4,18,'{bundle,free_gift}',
   'Premium Picks','Elevated pieces worth the splurge.','Explore','{fashion}',true),
  -- ── Category ───────────────────────────────────────────────────────────────
  ('fashion','sneakers','Sneaker Collection','The freshest kicks, curated.','👟','Sneakers and streetwear footwear.','category','unisex','sports_active',
   '["Sneakers","Socks","Caps"]',4,20,'{discount,bogo}',
   'Sneaker Collection','The freshest kicks, curated.','Shop sneakers','{fashion}',true),
  ('fashion','shirts','Shirts','Everyday shirts, done right.','👔','Shirts across fits and occasions.','category','men','minimal_fashion',
   '["Shirts","T-shirts"]',4,24,'{discount,bundle}',
   'Shirts','Everyday shirts, done right.','Shop shirts','{fashion}',true),
  ('fashion','jewellery','Jewellery Picks','Finishing touches that shine.','💍','Jewellery and fine accessories.','category','women','luxury_editorial',
   '["Earrings","Necklaces","Rings","Bracelets"]',4,20,'{free_gift,bundle}',
   'Jewellery Picks','Finishing touches that shine.','Explore','{fashion}',true),
  ('fashion','ethnic_wear','Ethnic Wear','Tradition, reimagined.','🪔','Ethnic and fusion wear.','category','unisex','festive_collection',
   '["Kurtas","Sarees","Lehenga","Sherwani"]',4,24,'{discount,bundle,free_gift}',
   'Ethnic Wear','Tradition, reimagined.','Shop ethnic','{fashion}',true),
  -- ── Trend ──────────────────────────────────────────────────────────────────
  ('fashion','new_drops','New Drops','Fresh in, straight from creators.','🔥','The newest arrivals and drops.','trend','unisex','sports_active',
   '["Sneakers","T-shirts","Jackets","Accessories"]',4,20,'{discount}',
   'New Drops','Fresh in, straight from creators.','Explore new','{fashion}',true),
  ('fashion','summer_state','Summer State of Mind','Warm-weather style, sorted.','☀️','Summer seasonal edit.','trend','unisex','summer_collection',
   '["Shorts","T-shirts","Sandals","Sunglasses"]',4,20,'{discount,bogo}',
   'Summer State of Mind','Warm-weather style, sorted.','Shop summer','{fashion}',true),
  ('fashion','monsoon_ready','Monsoon Ready','Rain-proof and runway-ready.','🌧️','Monsoon-appropriate style.','trend','unisex','travel_lifestyle',
   '["Jackets","Boots","Umbrellas","Quick-dry"]',4,16,'{discount,bundle}',
   'Monsoon Ready','Rain-proof and runway-ready.','Explore','{fashion}',true)
ON CONFLICT (world_key, key, is_blueprint) DO UPDATE SET
  name=EXCLUDED.name, subtitle=EXCLUDED.subtitle, icon=EXCLUDED.icon, description=EXCLUDED.description,
  purpose=EXCLUDED.purpose, audience=EXCLUDED.audience, preset_key=EXCLUDED.preset_key,
  supported_categories=EXCLUDED.supported_categories, min_products=EXCLUDED.min_products,
  max_products=EXCLUDED.max_products, supported_offer_types=EXCLUDED.supported_offer_types,
  default_title=EXCLUDED.default_title, default_subtitle=EXCLUDED.default_subtitle,
  default_cta=EXCLUDED.default_cta, applicable_worlds=EXCLUDED.applicable_worlds, updated_at=now();
