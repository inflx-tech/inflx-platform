-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — Master Catalogue (Vehicles + Salon Services)
-- Creates pre-seeded lookup tables for car rental and salon categories.
-- Brands "activate" items from the master list by setting price + availability.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Master Vehicles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS master_vehicles (
  id              SERIAL PRIMARY KEY,
  make            TEXT NOT NULL,
  model           TEXT NOT NULL,
  display_name    TEXT GENERATED ALWAYS AS (make || ' ' || model) STORED,
  segment         TEXT NOT NULL CHECK (segment IN ('Hatchback','Sedan','SUV','MUV','Luxury','Mini Bus')),
  seats           INTEGER NOT NULL DEFAULT 5,
  fuel_type       TEXT NOT NULL DEFAULT 'Petrol',
  transmission    TEXT NOT NULL DEFAULT 'Manual',
  image_url       TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- ── Master Salon Services ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS master_salon_services (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL CHECK (category IN ('Hair Men','Hair Women','Skin','Nails','Makeup','Spa')),
  gender               TEXT NOT NULL DEFAULT 'unisex' CHECK (gender IN ('men','women','unisex')),
  duration_mins_default INTEGER NOT NULL DEFAULT 30,
  image_url            TEXT,
  sort_order           INTEGER NOT NULL DEFAULT 0
);

-- ── Add FK columns to brand_products ─────────────────────────────────────────
ALTER TABLE brand_products
  ADD COLUMN IF NOT EXISTS master_vehicle_id  INTEGER REFERENCES master_vehicles(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS master_service_id  INTEGER REFERENCES master_salon_services(id) ON DELETE SET NULL;

-- ── Seed: Master Vehicles ─────────────────────────────────────────────────────
-- Using Unsplash photo IDs, one distinct image per segment group

-- Hatchbacks
INSERT INTO master_vehicles (make, model, segment, seats, fuel_type, transmission, image_url, sort_order) VALUES
('Maruti Suzuki', 'Swift',        'Hatchback', 5, 'Petrol',    'Manual',    'https://images.unsplash.com/photo-1549317336-74369d2f5f77?w=800&q=80', 1),
('Maruti Suzuki', 'Baleno',       'Hatchback', 5, 'Petrol',    'Automatic', 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80', 2),
('Hyundai',       'Grand i10 Nios','Hatchback', 5, 'Petrol',   'Manual',    'https://images.unsplash.com/photo-1549317336-74369d2f5f77?w=800&q=80', 3),
('Hyundai',       'i20',          'Hatchback', 5, 'Petrol',    'Manual',    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80', 4),
('Tata',          'Tiago',        'Hatchback', 5, 'Petrol',    'Manual',    'https://images.unsplash.com/photo-1549317336-74369d2f5f77?w=800&q=80', 5),
('Maruti Suzuki', 'WagonR',       'Hatchback', 5, 'CNG',       'Manual',    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80', 6)
ON CONFLICT DO NOTHING;

-- Sedans
INSERT INTO master_vehicles (make, model, segment, seats, fuel_type, transmission, image_url, sort_order) VALUES
('Honda',         'City',         'Sedan', 5, 'Petrol',    'CVT',       'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80', 10),
('Maruti Suzuki', 'Ciaz',         'Sedan', 5, 'Petrol',    'Automatic', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80', 11),
('Hyundai',       'Verna',        'Sedan', 5, 'Petrol',    'Manual',    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80', 12),
('Skoda',         'Slavia',       'Sedan', 5, 'Petrol',    'Automatic', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80', 13),
('Toyota',        'Yaris',        'Sedan', 5, 'Petrol',    'CVT',       'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80', 14)
ON CONFLICT DO NOTHING;

-- SUVs
INSERT INTO master_vehicles (make, model, segment, seats, fuel_type, transmission, image_url, sort_order) VALUES
('Hyundai',       'Creta',        'SUV', 5, 'Petrol',    'Automatic', 'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=800&q=80', 20),
('Kia',           'Seltos',       'SUV', 5, 'Petrol',    'Automatic', 'https://images.unsplash.com/photo-1519641471654-ac5d3a759f62?w=800&q=80', 21),
('Tata',          'Nexon',        'SUV', 5, 'Petrol',    'Manual',    'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=800&q=80', 22),
('Maruti Suzuki', 'Brezza',       'SUV', 5, 'Petrol',    'Automatic', 'https://images.unsplash.com/photo-1519641471654-ac5d3a759f62?w=800&q=80', 23),
('Mahindra',      'XUV300',       'SUV', 5, 'Diesel',    'Manual',    'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=800&q=80', 24),
('MG',            'Hector',       'SUV', 5, 'Petrol',    'Manual',    'https://images.unsplash.com/photo-1519641471654-ac5d3a759f62?w=800&q=80', 25),
('Jeep',          'Compass',      'SUV', 5, 'Diesel',    'Automatic', 'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=800&q=80', 26)
ON CONFLICT DO NOTHING;

-- MUVs / MPVs
INSERT INTO master_vehicles (make, model, segment, seats, fuel_type, transmission, image_url, sort_order) VALUES
('Toyota',        'Innova Crysta', 'MUV', 7, 'Diesel',    'Manual',    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', 30),
('Toyota',        'Innova HyCross','MUV', 7, 'Petrol Hybrid','Automatic','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', 31),
('Maruti Suzuki', 'Ertiga',       'MUV', 7, 'Petrol',    'Automatic', 'https://images.unsplash.com/photo-1570732488629-e44d2c5cab62?w=800&q=80', 32),
('Kia',           'Carens',       'MUV', 7, 'Petrol',    'Manual',    'https://images.unsplash.com/photo-1570732488629-e44d2c5cab62?w=800&q=80', 33),
('Mahindra',      'Marazzo',      'MUV', 8, 'Diesel',    'Manual',    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', 34)
ON CONFLICT DO NOTHING;

-- Luxury
INSERT INTO master_vehicles (make, model, segment, seats, fuel_type, transmission, image_url, sort_order) VALUES
('BMW',           '3 Series',     'Luxury', 5, 'Petrol',   'Automatic', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80', 40),
('Mercedes-Benz', 'C-Class',      'Luxury', 5, 'Petrol',   'Automatic', 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80', 41),
('Audi',          'A4',           'Luxury', 5, 'Petrol',   'Automatic', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80', 42),
('Volvo',         'XC40',         'Luxury', 5, 'Petrol',   'Automatic', 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80', 43),
('Jaguar',        'XE',           'Luxury', 5, 'Petrol',   'Automatic', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80', 44)
ON CONFLICT DO NOTHING;

-- Mini Bus
INSERT INTO master_vehicles (make, model, segment, seats, fuel_type, transmission, image_url, sort_order) VALUES
('Toyota',        'Hiace',        'Mini Bus', 12, 'Diesel', 'Manual', 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80', 50),
('Force',         'Traveller 12', 'Mini Bus', 12, 'Diesel', 'Manual', 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80', 51),
('Force',         'Traveller 17', 'Mini Bus', 17, 'Diesel', 'Manual', 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80', 52),
('Tata',          'Winger 17',    'Mini Bus', 17, 'Diesel', 'Manual', 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80', 53),
('Force',         'Traveller 26', 'Mini Bus', 26, 'Diesel', 'Manual', 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80', 54)
ON CONFLICT DO NOTHING;

-- ── Seed: Master Salon Services ───────────────────────────────────────────────

-- Hair Men
INSERT INTO master_salon_services (name, category, gender, duration_mins_default, image_url, sort_order) VALUES
('Haircut',                   'Hair Men', 'men',   30, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80', 1),
('Beard Trim',                'Hair Men', 'men',   15, 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80', 2),
('Haircut + Beard',           'Hair Men', 'men',   45, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80', 3),
('Head Massage',              'Hair Men', 'men',   30, 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=800&q=80', 4),
('Hair Color (Men)',          'Hair Men', 'men',   60, 'https://images.unsplash.com/photo-1560066984-138daaa5a6f3?w=800&q=80', 5),
('Hair Straightening (Men)',  'Hair Men', 'men',  120, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80', 6),
('Clean Shave',               'Hair Men', 'men',   15, 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80', 7),
('Hair Spa (Men)',            'Hair Men', 'men',   60, 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=800&q=80', 8)
ON CONFLICT DO NOTHING;

-- Hair Women
INSERT INTO master_salon_services (name, category, gender, duration_mins_default, image_url, sort_order) VALUES
('Haircut (Women)',           'Hair Women', 'women',  45, 'https://images.unsplash.com/photo-1522337360826-0f82b066e9ad?w=800&q=80', 10),
('Blow Dry',                  'Hair Women', 'women',  30, 'https://images.unsplash.com/photo-1560066984-138daaa5a6f3?w=800&q=80', 11),
('Hair Color (Global)',       'Hair Women', 'women',  90, 'https://images.unsplash.com/photo-1522337360826-0f82b066e9ad?w=800&q=80', 12),
('Highlights',                'Hair Women', 'women',  90, 'https://images.unsplash.com/photo-1560066984-138daaa5a6f3?w=800&q=80', 13),
('Hair Smoothening',          'Hair Women', 'women', 180, 'https://images.unsplash.com/photo-1522337360826-0f82b066e9ad?w=800&q=80', 14),
('Keratin Treatment',         'Hair Women', 'women', 180, 'https://images.unsplash.com/photo-1560066984-138daaa5a6f3?w=800&q=80', 15),
('Hair Spa',                  'Hair Women', 'women',  60, 'https://images.unsplash.com/photo-1522337360826-0f82b066e9ad?w=800&q=80', 16),
('Balayage',                  'Hair Women', 'women', 120, 'https://images.unsplash.com/photo-1560066984-138daaa5a6f3?w=800&q=80', 17)
ON CONFLICT DO NOTHING;

-- Skin
INSERT INTO master_salon_services (name, category, gender, duration_mins_default, image_url, sort_order) VALUES
('Basic Cleanup',             'Skin', 'women',  30, 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&q=80', 20),
('Hydrating Facial',          'Skin', 'women',  60, 'https://images.unsplash.com/photo-1515377905736-0f7b6b1e4fb3?w=800&q=80', 21),
('De-tan Treatment',          'Skin', 'unisex', 45, 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&q=80', 22),
('Bleach',                    'Skin', 'women',  30, 'https://images.unsplash.com/photo-1515377905736-0f7b6b1e4fb3?w=800&q=80', 23),
('Microdermabrasion',         'Skin', 'women',  60, 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&q=80', 24),
('Gold Facial',               'Skin', 'women',  90, 'https://images.unsplash.com/photo-1515377905736-0f7b6b1e4fb3?w=800&q=80', 25)
ON CONFLICT DO NOTHING;

-- Nails
INSERT INTO master_salon_services (name, category, gender, duration_mins_default, image_url, sort_order) VALUES
('Manicure',                  'Nails', 'women',  30, 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80', 30),
('Pedicure',                  'Nails', 'women',  45, 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80', 31),
('Gel Nail Polish',           'Nails', 'women',  60, 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80', 32),
('Nail Art',                  'Nails', 'women',  60, 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80', 33),
('Nail Extensions',           'Nails', 'women',  90, 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80', 34)
ON CONFLICT DO NOTHING;

-- Makeup
INSERT INTO master_salon_services (name, category, gender, duration_mins_default, image_url, sort_order) VALUES
('Party Makeup',              'Makeup', 'women',  60, 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80', 40),
('Bridal Makeup',             'Makeup', 'women', 180, 'https://images.unsplash.com/photo-1526406915894-7bcd65f60845?w=800&q=80', 41),
('Airbrush Makeup',           'Makeup', 'women',  90, 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80', 42),
('Eye Makeup',                'Makeup', 'women',  30, 'https://images.unsplash.com/photo-1526406915894-7bcd65f60845?w=800&q=80', 43)
ON CONFLICT DO NOTHING;

-- Spa
INSERT INTO master_salon_services (name, category, gender, duration_mins_default, image_url, sort_order) VALUES
('Swedish Massage',           'Spa', 'unisex',  60, 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80', 50),
('Deep Tissue Massage',       'Spa', 'unisex',  60, 'https://images.unsplash.com/photo-1544161515-4387b895047a?w=800&q=80', 51),
('Head & Shoulder Massage',   'Spa', 'unisex',  30, 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80', 52),
('Body Polishing',            'Spa', 'women',   90, 'https://images.unsplash.com/photo-1544161515-4387b895047a?w=800&q=80', 53),
('Couple Spa',                'Spa', 'unisex',  90, 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80', 54),
('Foot Reflexology',          'Spa', 'unisex',  45, 'https://images.unsplash.com/photo-1544161515-4387b895047a?w=800&q=80', 55)
ON CONFLICT DO NOTHING;
