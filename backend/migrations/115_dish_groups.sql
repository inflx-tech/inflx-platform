-- 115 — Dish groups (food discovery tiles).
--
-- An admin-created "type group" tile (e.g. Biryani, Paratha, Pizza). Tapping it
-- on the food home shows nearby restaurants serving any dish in the group.
-- Matching = explicit member master_dishes OR an optional name keyword
-- (safety net for restaurants' custom/oddly-named dishes — reliable because a
-- restaurant lists a biryani within the biryani hierarchy, not under Breads).
--
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS dish_groups (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  image_url   text,
  keyword     text,                         -- optional name-match safety net
  sort_order  int  NOT NULL DEFAULT 0,
  status      varchar(16) NOT NULL DEFAULT 'active',  -- active | hidden
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Explicit members: which dictionary dishes belong to the group.
CREATE TABLE IF NOT EXISTS dish_group_dishes (
  dish_group_id  int NOT NULL REFERENCES dish_groups(id) ON DELETE CASCADE,
  master_dish_id int NOT NULL REFERENCES master_dishes(id) ON DELETE CASCADE,
  PRIMARY KEY (dish_group_id, master_dish_id)
);

CREATE INDEX IF NOT EXISTS idx_dish_group_dishes_group ON dish_group_dishes (dish_group_id);
CREATE INDEX IF NOT EXISTS idx_dish_group_dishes_dish  ON dish_group_dishes (master_dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_groups_active       ON dish_groups (status, sort_order);
