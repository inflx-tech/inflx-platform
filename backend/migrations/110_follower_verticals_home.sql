-- 110 — Follower v2 home: business-verticals registry + per-vertical home
-- categories (the world switcher tabs + the "What's on your mind?" 3D rail).
--
-- (Numbered 110: the shared tree already has 108_referral_applications +
-- 109_admin_capabilities from a parallel window.)
--
-- Two NEW additive tables (don't touch the legacy super-category logic in
-- follower_categories / listing.service):
--   follower_verticals            — the top-level world tabs (Food/Fashion/…)
--   follower_vertical_categories  — the per-vertical category rail (Pizza/Biryani…)
-- Both carry name + emoji icon + nullable image_url (admin uploads a 3D image
-- later; mobile falls back to the icon until then) + sort_order + enabled, so
-- admin can rename / reorder / upload-image / hide. Contract:
-- features/follower-location-redesign (extended — home slice).

CREATE TABLE IF NOT EXISTS follower_verticals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  name        text NOT NULL,
  icon        text,                       -- emoji fallback
  image_url   text,                       -- admin-uploaded 3D image (nullable)
  accent_hex  text,                       -- per-world atmosphere colour
  sort_order  int  NOT NULL DEFAULT 0,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follower_vertical_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_key text NOT NULL,             -- → follower_verticals.key
  key          text NOT NULL,
  name         text NOT NULL,
  icon         text,
  image_url    text,                      -- admin-uploaded 3D image (nullable)
  sort_order   int  NOT NULL DEFAULT 0,
  enabled      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vertical_key, key)
);
CREATE INDEX IF NOT EXISTS idx_fvc_vertical ON follower_vertical_categories (vertical_key, sort_order);

-- Seed the 5 worlds (idempotent).
INSERT INTO follower_verticals (key, name, icon, accent_hex, sort_order) VALUES
  ('food',      'Food',      '🍔', '#F8CB46', 1),
  ('fashion',   'Fashion',   '👗', '#E11D6B', 2),
  ('furniture', 'Furniture', '🛋️', '#92400E', 3),
  ('beauty',    'Beauty',    '💄', '#7C3AED', 4),
  ('cars',      'Cars',      '🚗', '#1D4ED8', 5)
ON CONFLICT (key) DO NOTHING;

-- Seed Food's "What's on your mind?" categories (idempotent). Other verticals'
-- categories are added by admin later.
INSERT INTO follower_vertical_categories (vertical_key, key, name, icon, sort_order) VALUES
  ('food', 'biryani',      'Biryani',      '🍛', 1),
  ('food', 'south_indian', 'South Indian', '🥘', 2),
  ('food', 'pizza',        'Pizza',        '🍕', 3),
  ('food', 'cake',         'Cake',         '🍰', 4),
  ('food', 'chinese',      'Chinese',      '🍜', 5),
  ('food', 'dessert',      'Dessert',      '🍨', 6)
ON CONFLICT (vertical_key, key) DO NOTHING;
