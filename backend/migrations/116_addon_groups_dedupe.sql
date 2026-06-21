-- 116 — De-duplicate product_addon_groups + prevent recurrence.
--
-- A bug caused some products to accumulate many identical groups (e.g. "Choose
-- your toppings" ×16). The bulk-replace endpoint is correct (delete+insert), so
-- this hard-guarantees no duplicates at the data layer: collapse existing dupes
-- (keep the lowest id per product+name; duplicate groups' items cascade), then a
-- UNIQUE index so a product can never hold two groups with the same name.
--
-- Idempotent + additive.

-- 1. Collapse existing duplicates (keep min(id) per product_id + name).
DELETE FROM product_addon_groups a
 USING product_addon_groups b
 WHERE a.product_id = b.product_id
   AND a.name       = b.name
   AND a.id > b.id;

-- 2. Guarantee uniqueness going forward.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_addon_group_product_name
  ON product_addon_groups (product_id, name);
