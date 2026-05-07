-- Migration 035: master_dishes table + brand_products.master_dish_id
-- Additive only.
--
-- Background
-- ----------
-- Restaurant authoring rework (PR-1 + PR-2) introduces a curated catalogue
-- of dishes the brand picks from in step 4's "Add Individually" path —
-- same activation pattern as master_vehicles (car_rental) and
-- master_salon_services (salon). Brand picks a master row, the platform
-- pre-fills name + image + suggested price; brand confirms or tweaks.
--
-- master_dishes content is admin-owned forever. Engineering ships the
-- plumbing (this table + the dispatch in /brands/me/master-catalogue +
-- master_dish_id FK on brand_products); admin manages content via the
-- admin-web CRUD UI landing in the next phase. The seed below is the
-- phase-1 starter set (~129 rows, 8 cuisines) so brands can start
-- authoring on launch — admin tool grows it from there.
--
-- Section naming is cuisine-specific (Tiffins for South Indian, Biryanis
-- for Hyderabadi, etc.) per spec — this is NOT constrained to the
-- restaurant.json top-level sections[] array (which drives the bulk-upload
-- Section dropdown for free-form rows). Different audiences, different
-- shapes.
--
-- Co-shipped consumer updates (PR-1)
-- ----------------------------------
-- 1. brand.controller.js  — getMasterCatalogue gets a `restaurant` branch
--                            joining master_dishes with brand's existing
--                            brand_products on master_dish_id, annotated
--                            with is_activated + product_id + activated_price.
-- 2. (PR-2 follow-up)      — restaurant.json's menu step changes to
--                            component: restaurant_dish_picker; the new
--                            picker queries this table via the same endpoint.

-- 1. master_dishes table
CREATE TABLE IF NOT EXISTS master_dishes (
  id                   SERIAL PRIMARY KEY,
  cuisine              TEXT NOT NULL,
  section              TEXT NOT NULL,
  name                 TEXT NOT NULL,
  default_image_url    TEXT,
  suggested_price_min  INTEGER,
  suggested_price_max  INTEGER,
  default_description  TEXT,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. brand_products gains master_dish_id FK (nullable; same shape as
--    master_vehicle_id and master_service_id on the same table).
ALTER TABLE brand_products
  ADD COLUMN IF NOT EXISTS master_dish_id INTEGER REFERENCES master_dishes(id) ON DELETE SET NULL;

-- 3. Index supporting per-brand activation lookups in the dispatch endpoint.
CREATE INDEX IF NOT EXISTS idx_brand_products_master_dish_id
  ON brand_products (master_dish_id) WHERE master_dish_id IS NOT NULL;

-- 4. Index supporting cuisine + section grouping in the picker UI query.
CREATE INDEX IF NOT EXISTS idx_master_dishes_cuisine_section
  ON master_dishes (cuisine, section, sort_order);

COMMENT ON TABLE  master_dishes                      IS 'Curated restaurant menu items the brand picks from in step 4 individual-add. Admin-managed via admin-web CRUD (next phase).';
COMMENT ON COLUMN master_dishes.cuisine              IS 'MUST match a verbatim entry in restaurant.json brand_config.fields.cuisines.options.';
COMMENT ON COLUMN master_dishes.section              IS 'Cuisine-specific category grouping (Tiffins / Curries / Biryanis / etc.) — NOT constrained to restaurant.json top-level sections[].';
COMMENT ON COLUMN master_dishes.suggested_price_min  IS 'Tier-2 India typical menu pricing floor (rupees). Used as guidance in the picker UI.';
COMMENT ON COLUMN master_dishes.suggested_price_max  IS 'Tier-2 India typical menu pricing ceiling (rupees).';
COMMENT ON COLUMN brand_products.master_dish_id      IS 'FK to master_dishes when the brand activated via the picker. NULL for bulk-upload rows or pre-master_dishes legacy data.';

-- 5. Phase-1 seed — 129 rows across 8 cuisines.
--    Per chat decision: this is the starter seed; admin owns expansion forever.
INSERT INTO master_dishes (cuisine, section, name, default_image_url, suggested_price_min, suggested_price_max, default_description, sort_order) VALUES
-- ── South Indian ────────────────────────────────────────────────────────────
('South Indian', 'Tiffins', 'Idli', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 40, 80, 'Steamed rice cakes served with sambar and coconut chutney', 1),
('South Indian', 'Tiffins', 'Plain Dosa', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&q=80', 60, 120, 'Crisp rice and lentil crepe served with chutneys and sambar', 2),
('South Indian', 'Tiffins', 'Masala Dosa', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&q=80', 80, 150, 'Dosa stuffed with spiced potato filling', 3),
('South Indian', 'Tiffins', 'Mysore Masala Dosa', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&q=80', 90, 160, 'Dosa with spicy red chutney spread and potato filling', 4),
('South Indian', 'Tiffins', 'Medu Vada', 'https://images.unsplash.com/photo-1626501203471-65a8e7d2c4f8?w=800&q=80', 50, 100, 'Crispy savoury lentil doughnuts served with chutney and sambar', 5),
('South Indian', 'Tiffins', 'Uttapam', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&q=80', 70, 140, 'Thick pancake topped with onions tomatoes and chillies', 6),
('South Indian', 'Tiffins', 'Pesarattu', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&q=80', 70, 130, 'Andhra-style green gram crepe served with ginger chutney', 7),
('South Indian', 'Tiffins', 'Ven Pongal', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 80, 140, 'Soft rice and lentil porridge tempered with cumin and pepper', 8),
('South Indian', 'Tiffins', 'Rava Upma', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 60, 110, 'Semolina cooked with vegetables and tempered spices', 9),
('South Indian', 'Curries & Sambars', 'Sambar', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 60, 120, 'Tangy lentil and vegetable stew with tamarind', 10),
('South Indian', 'Curries & Sambars', 'Rasam', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 50, 100, 'Light spicy soup with tamarind and pepper', 11),
('South Indian', 'Curries & Sambars', 'Avial', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 90, 170, 'Mixed vegetables in coconut and yogurt gravy', 12),
('South Indian', 'Curries & Sambars', 'Kootu', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 80, 150, 'Lentil and vegetable curry with mild coconut', 13),
('South Indian', 'Rice', 'Curd Rice', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 80, 140, 'Rice mixed with yogurt and tempered spices', 14),
('South Indian', 'Rice', 'Lemon Rice', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 80, 140, 'Tangy rice tempered with mustard peanuts and curry leaves', 15),
('South Indian', 'Rice', 'Tamarind Rice (Pulihora)', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 90, 150, 'Tamarind-flavoured rice with peanuts and tempered spices', 16),
('South Indian', 'Rice', 'Bisi Bele Bath', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 100, 180, 'Spicy rice cooked with lentils and vegetables', 17),
('South Indian', 'Rice', 'Coconut Rice', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 90, 150, 'Rice tempered with grated coconut and curry leaves', 18),
('South Indian', 'Beverages', 'Filter Coffee', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80', 30, 80, 'Strong South Indian filter coffee with chicory', 19),
('South Indian', 'Beverages', 'Buttermilk', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80', 30, 70, 'Spiced yogurt drink with curry leaves and ginger', 20),
('South Indian', 'Sweets', 'Mysore Pak', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 40, 100, 'Rich gram flour and ghee fudge', 21),
('South Indian', 'Sweets', 'Payasam', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 60, 140, 'Sweet rice or vermicelli pudding with cardamom', 22),
('South Indian', 'Sweets', 'Boorelu', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 60, 130, 'Andhra sweet stuffed dumplings', 23),

-- ── North Indian ────────────────────────────────────────────────────────────
('North Indian', 'Starters', 'Paneer Tikka', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 180, 320, 'Marinated paneer cubes grilled in tandoor', 1),
('North Indian', 'Starters', 'Tandoori Chicken', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80', 250, 450, 'Yogurt and spice marinated chicken roasted in tandoor', 2),
('North Indian', 'Starters', 'Hara Bhara Kebab', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80', 160, 280, 'Spinach and pea patties shallow fried', 3),
('North Indian', 'Starters', 'Aloo Tikki', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80', 80, 180, 'Spiced potato patties served with chutneys', 4),
('North Indian', 'Starters', 'Chicken Tikka', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80', 220, 400, 'Marinated chicken pieces grilled in tandoor', 5),
('North Indian', 'Curries', 'Butter Chicken', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 250, 450, 'Tandoori chicken in rich tomato butter gravy', 6),
('North Indian', 'Curries', 'Dal Makhani', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 180, 320, 'Slow-cooked black lentils in butter and cream', 7),
('North Indian', 'Curries', 'Paneer Butter Masala', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 200, 360, 'Paneer cubes in creamy tomato gravy', 8),
('North Indian', 'Curries', 'Palak Paneer', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 180, 320, 'Paneer in spinach gravy with mild spices', 9),
('North Indian', 'Curries', 'Kadai Paneer', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 200, 350, 'Paneer with bell peppers in onion-tomato masala', 10),
('North Indian', 'Curries', 'Chole', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 150, 280, 'Chickpeas in spiced tomato gravy', 11),
('North Indian', 'Curries', 'Rajma', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 150, 280, 'Red kidney beans in onion-tomato gravy', 12),
('North Indian', 'Breads', 'Naan', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 50, 100, 'Soft leavened flatbread baked in tandoor', 13),
('North Indian', 'Breads', 'Garlic Naan', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 60, 120, 'Naan topped with garlic and coriander', 14),
('North Indian', 'Breads', 'Tandoori Roti', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 30, 70, 'Whole wheat flatbread baked in tandoor', 15),
('North Indian', 'Breads', 'Aloo Paratha', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 80, 160, 'Wheat flatbread stuffed with spiced potato', 16),
('North Indian', 'Breads', 'Lachha Paratha', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 60, 130, 'Layered crispy whole wheat flatbread', 17),
('North Indian', 'Rice', 'Jeera Rice', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 100, 180, 'Basmati rice tempered with cumin', 18),
('North Indian', 'Rice', 'Veg Pulao', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 140, 260, 'Mildly spiced rice with mixed vegetables', 19),
('North Indian', 'Sweets', 'Gulab Jamun', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 40, 100, 'Deep-fried milk dumplings in cardamom sugar syrup', 20),
('North Indian', 'Sweets', 'Jalebi', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 40, 100, 'Crispy spiral sweet soaked in saffron syrup', 21),

-- ── Chinese ─────────────────────────────────────────────────────────────────
('Chinese', 'Soups', 'Hot & Sour Soup', 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80', 90, 180, 'Chinese soup with vegetables tofu and tangy spices', 1),
('Chinese', 'Soups', 'Sweet Corn Soup', 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80', 90, 170, 'Sweet corn kernels in clear vegetable broth', 2),
('Chinese', 'Soups', 'Manchow Soup', 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80', 100, 190, 'Spicy thick soup with vegetables and crispy noodles', 3),
('Chinese', 'Starters', 'Veg Spring Rolls', 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80', 140, 260, 'Crispy rolls stuffed with vegetables and noodles', 4),
('Chinese', 'Starters', 'Chilli Chicken Dry', 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80', 220, 400, 'Chicken tossed in spicy soy sauce with peppers and onions', 5),
('Chinese', 'Starters', 'Chicken Lollipop', 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80', 200, 380, 'Crispy fried chicken drumettes in spicy sauce', 6),
('Chinese', 'Starters', 'Honey Chilli Potato', 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80', 160, 280, 'Crispy potato fingers tossed in honey chilli sauce', 7),
('Chinese', 'Noodles & Rice', 'Hakka Noodles', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80', 140, 260, 'Stir-fried noodles with vegetables and Chinese sauces', 8),
('Chinese', 'Noodles & Rice', 'Schezwan Noodles', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80', 150, 280, 'Spicy schezwan-style stir-fried noodles', 9),
('Chinese', 'Noodles & Rice', 'Veg Fried Rice', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80', 140, 260, 'Wok-tossed rice with vegetables and soy', 10),
('Chinese', 'Noodles & Rice', 'Schezwan Fried Rice', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80', 150, 280, 'Spicy schezwan-flavoured fried rice', 11),
('Chinese', 'Noodles & Rice', 'Chicken Fried Rice', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&q=80', 180, 320, 'Wok-tossed rice with chicken and vegetables', 12),
('Chinese', 'Curries', 'Veg Manchurian Gravy', 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80', 160, 300, 'Vegetable balls in tangy soy-garlic gravy', 13),
('Chinese', 'Curries', 'Chilli Paneer', 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80', 200, 360, 'Paneer cubes in indo-chinese chilli sauce', 14),
('Chinese', 'Curries', 'Chicken Manchurian', 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80', 220, 400, 'Chicken in tangy soy-garlic gravy', 15),

-- ── Andhra ──────────────────────────────────────────────────────────────────
('Andhra', 'Tiffins', 'Pesarattu', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&q=80', 70, 130, 'Andhra-style green gram crepe served with ginger chutney', 1),
('Andhra', 'Tiffins', 'Punugulu', 'https://images.unsplash.com/photo-1626501203471-65a8e7d2c4f8?w=800&q=80', 50, 100, 'Crispy fried lentil snack from coastal Andhra', 2),
('Andhra', 'Tiffins', 'Mirchi Bajji', 'https://images.unsplash.com/photo-1626501203471-65a8e7d2c4f8?w=800&q=80', 40, 90, 'Stuffed green chillies dipped in batter and fried', 3),
('Andhra', 'Curries', 'Andhra Chicken Curry', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 220, 400, 'Spicy Andhra-style chicken curry with red chillies', 4),
('Andhra', 'Curries', 'Gongura Mutton', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 300, 550, 'Tangy mutton curry with sorrel leaves', 5),
('Andhra', 'Curries', 'Natu Kodi Pulusu', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 280, 500, 'Country chicken curry with tamarind gravy', 6),
('Andhra', 'Curries', 'Kodi Vepudu', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 240, 420, 'Andhra-style chicken roast with curry leaves', 7),
('Andhra', 'Curries', 'Royyala Iguru', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 260, 460, 'Coastal prawn curry with onion and tamarind', 8),
('Andhra', 'Curries', 'Bendakaya Ulli Karam', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 150, 260, 'Okra cooked with onions and red chilli paste', 9),
('Andhra', 'Rice', 'Pulihora', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 90, 150, 'Tamarind-flavoured rice with peanuts and tempered spices', 10),
('Andhra', 'Rice', 'Bagara Annam', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 80, 140, 'Mildly spiced fragrant rice', 11),
('Andhra', 'Rice', 'Ulavacharu Rice', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 140, 250, 'Rice with horse gram broth Andhra speciality', 12),
('Andhra', 'Rice', 'Pesara Pappu Annam', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80', 100, 180, 'Rice with green gram dal and ghee', 13),
('Andhra', 'Pickles & Sides', 'Avakaya', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 30, 80, 'Spicy raw mango pickle with mustard', 14),
('Andhra', 'Pickles & Sides', 'Gongura Pachadi', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 40, 100, 'Tangy sorrel leaf chutney', 15),
('Andhra', 'Pickles & Sides', 'Tomato Pachadi', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 30, 80, 'Tangy tomato chutney tempered with mustard', 16),

-- ── Hyderabadi ──────────────────────────────────────────────────────────────
('Hyderabadi', 'Biryanis', 'Hyderabadi Chicken Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 250, 450, 'Aromatic dum-cooked chicken biryani with saffron', 1),
('Hyderabadi', 'Biryanis', 'Hyderabadi Mutton Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 320, 600, 'Slow-cooked mutton biryani layered with basmati', 2),
('Hyderabadi', 'Biryanis', 'Hyderabadi Veg Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 200, 380, 'Vegetable biryani with raita and salan', 3),
('Hyderabadi', 'Curries', 'Mirchi ka Salan', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 130, 240, 'Green chillies in peanut and sesame gravy classic biryani side', 4),
('Hyderabadi', 'Curries', 'Bagara Baingan', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 150, 280, 'Baby brinjals in coconut and peanut gravy', 5),
('Hyderabadi', 'Curries', 'Haleem', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 250, 450, 'Slow-cooked wheat lentils and meat stew', 6),
('Hyderabadi', 'Curries', 'Nihari', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80', 280, 500, 'Slow-cooked meat stew traditionally eaten at breakfast', 7),
('Hyderabadi', 'Starters', 'Chicken 65', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80', 200, 360, 'Spicy deep-fried chicken Hyderabadi style', 8),
('Hyderabadi', 'Starters', 'Pathar ka Gosht', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80', 300, 550, 'Mutton cooked on a heated stone slab', 9),
('Hyderabadi', 'Starters', 'Boti Kebab', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80', 260, 460, 'Tender mutton chunks marinated and grilled', 10),
('Hyderabadi', 'Sweets', 'Khubani ka Meetha', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 80, 180, 'Stewed apricots topped with cream', 11),
('Hyderabadi', 'Sweets', 'Double ka Meetha', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 70, 160, 'Bread pudding soaked in saffron-flavoured milk', 12),
('Hyderabadi', 'Sweets', 'Sheer Korma', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 80, 180, 'Vermicelli pudding with milk dates and dry fruits', 13),

-- ── Biryani ─────────────────────────────────────────────────────────────────
('Biryani', 'Veg', 'Veg Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 180, 320, 'Mixed vegetable biryani with raita', 1),
('Biryani', 'Veg', 'Paneer Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 200, 360, 'Biryani with marinated paneer chunks', 2),
('Biryani', 'Veg', 'Soya Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 180, 320, 'Biryani with marinated soya chunks', 3),
('Biryani', 'Chicken', 'Chicken Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 220, 400, 'Classic chicken biryani with raita and salan', 4),
('Biryani', 'Chicken', 'Chicken Dum Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 250, 450, 'Slow-cooked dum-style chicken biryani', 5),
('Biryani', 'Chicken', 'Chicken 65 Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 260, 470, 'Biryani topped with crispy chicken 65', 6),
('Biryani', 'Mutton', 'Mutton Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 300, 550, 'Slow-cooked mutton biryani with aromatic spices', 7),
('Biryani', 'Mutton', 'Lucknowi Mutton Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 320, 600, 'Awadhi-style mild fragrant mutton biryani', 8),
('Biryani', 'Specialty', 'Egg Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 180, 320, 'Biryani with boiled eggs and aromatic spices', 9),
('Biryani', 'Specialty', 'Prawn Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 300, 550, 'Coastal-style biryani with marinated prawns', 10),
('Biryani', 'Specialty', 'Fish Biryani', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80', 280, 500, 'Biryani with marinated fish chunks', 11),

-- ── Continental ─────────────────────────────────────────────────────────────
('Continental', 'Pasta', 'Pasta Alfredo', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80', 220, 400, 'Penne or fettuccine in creamy white sauce', 1),
('Continental', 'Pasta', 'Penne Arrabbiata', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80', 220, 400, 'Penne in spicy tomato and garlic sauce', 2),
('Continental', 'Pasta', 'Spaghetti Bolognese', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80', 260, 460, 'Spaghetti in slow-cooked meat tomato sauce', 3),
('Continental', 'Pasta', 'Mac & Cheese', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80', 200, 360, 'Macaroni in creamy cheese sauce', 4),
('Continental', 'Pizza', 'Margherita Pizza', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80', 250, 450, 'Classic pizza with tomato basil and mozzarella', 5),
('Continental', 'Pizza', 'Farmhouse Pizza', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80', 300, 550, 'Pizza loaded with mixed vegetables and cheese', 6),
('Continental', 'Pizza', 'Veggie Supreme Pizza', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80', 320, 580, 'Pizza with peppers olives onions and corn', 7),
('Continental', 'Pizza', 'Chicken Pepperoni Pizza', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80', 360, 650, 'Pizza topped with chicken pepperoni and cheese', 8),
('Continental', 'Salads', 'Caesar Salad', 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=800&q=80', 180, 320, 'Romaine lettuce parmesan and caesar dressing', 9),
('Continental', 'Salads', 'Greek Salad', 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=800&q=80', 200, 360, 'Cucumber tomato olives and feta with olive oil', 10),
('Continental', 'Sandwiches', 'Club Sandwich', 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80', 180, 320, 'Triple-decker with chicken egg lettuce and mayo', 11),
('Continental', 'Sandwiches', 'Grilled Veg Sandwich', 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80', 140, 250, 'Grilled bread with vegetables and cheese', 12),
('Continental', 'Mains', 'Grilled Chicken', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80', 300, 550, 'Marinated chicken breast grilled with herbs', 13),
('Continental', 'Mains', 'Fish & Chips', 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=800&q=80', 280, 500, 'Battered fish with thick-cut fries and tartar', 14),
('Continental', 'Mains', 'Garlic Bread', 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80', 120, 220, 'Toasted bread with garlic butter and herbs', 15),

-- ── Desserts ────────────────────────────────────────────────────────────────
('Desserts', 'Indian', 'Gulab Jamun', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 40, 100, 'Deep-fried milk dumplings in cardamom sugar syrup', 1),
('Desserts', 'Indian', 'Ras Malai', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 80, 180, 'Soft cottage cheese patties in saffron milk', 2),
('Desserts', 'Indian', 'Kulfi', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 60, 140, 'Traditional Indian milk-based ice cream', 3),
('Desserts', 'Indian', 'Rasgulla', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 40, 100, 'Soft cottage cheese balls in sugar syrup', 4),
('Desserts', 'Indian', 'Gajar Halwa', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 80, 180, 'Slow-cooked carrot dessert with milk and ghee', 5),
('Desserts', 'Indian', 'Kheer', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 60, 140, 'Rice or vermicelli pudding with cardamom', 6),
('Desserts', 'Cakes', 'Chocolate Brownie', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 100, 220, 'Rich fudgy chocolate brownie', 7),
('Desserts', 'Cakes', 'Black Forest Pastry', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 80, 180, 'Chocolate sponge with cherries and cream', 8),
('Desserts', 'Cakes', 'Red Velvet Pastry', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 90, 200, 'Red velvet sponge with cream cheese frosting', 9),
('Desserts', 'Cakes', 'Cheesecake', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 140, 280, 'New York-style baked cheesecake', 10),
('Desserts', 'Cold', 'Falooda', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 80, 180, 'Rose-flavoured milk drink with vermicelli and basil seeds', 11),
('Desserts', 'Cold', 'Ice Cream Sundae', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 100, 220, 'Layered ice cream with sauces and toppings', 12),
('Desserts', 'Cold', 'Tender Coconut Ice Cream', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 100, 200, 'Smooth ice cream with tender coconut chunks', 13),
('Desserts', 'Pastries', 'Tiramisu', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 180, 320, 'Italian coffee-soaked layered dessert', 14),
('Desserts', 'Pastries', 'Pannacotta', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80', 160, 280, 'Italian set cream dessert with berry coulis', 15)
ON CONFLICT DO NOTHING;
