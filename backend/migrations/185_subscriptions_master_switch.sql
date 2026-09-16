-- 185_subscriptions_master_switch.sql
-- The subscriptions master switch. Contract: features/subscriptions-master-switch.
--
-- ONE ROW. No schema change: platform_settings.value is already an int with
-- CHECK (value BETWEEN min_value AND max_value), so a 0/1 key fits as it stands.
--
-- It arrives at 1 — ON — which is exactly today's behaviour. Applying this migration
-- changes nothing for anybody until an admin turns it off from
-- Admin → Settings → Platform.
--
-- Read the spec before changing the default. A missing row and a failed read BOTH
-- fall back to ON in platformSettings.service.js, deliberately: a settings failure
-- must never silently unlock the whole product.

INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
  ('subscriptions_enforced', 1, 0, 1, 'on/off', 'Subscription plans')
ON CONFLICT (key) DO NOTHING;
