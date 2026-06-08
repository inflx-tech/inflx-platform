-- 091 — Home greeting becomes admin-editable via a config-driven 'header' shelf.
--
-- Founder request 2026-06-08: the greeting "Hey, what's good today?" was hardcoded
-- in the app and not controllable from admin. Add a 'header' shelf to home
-- section_config (type 'controls', renders nothing as a body shelf) whose
-- config_json carries { greeting, tagline }. The mobile Home reads these (falling
-- back to the hardcoded defaults); the Admin Section Manager v2 edits them.
-- Idempotent (ON CONFLICT DO NOTHING — never overwrites later admin edits).

INSERT INTO section_config
  (screen, scope_type, scope_value, shelf_key, title, shelf_type, rule,
   item_type, category_key, item_limit, position, enabled, config_json)
VALUES
  ('home','global',NULL,'header','Header','controls','static',
   NULL,NULL,0,0,true,
   '{"greeting":"Hey, what''s good today?","tagline":"Shop · Support · Stay Inspired"}')
ON CONFLICT (screen, scope_type, COALESCE(scope_value,''), shelf_key,
             COALESCE(category_key,''), COALESCE(item_type,''))
DO NOTHING;
