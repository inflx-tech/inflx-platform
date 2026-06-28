-- 121: admin-owned delivery ETA (stakeholder-sale-info S-D). One simple rule the
-- admin sets — a reference distance + days (e.g. 100 km = 2 days). The system
-- measures store↔address distance and scales: days = ceil(distance/ref_km × ref_days).
-- Replaces the hardcoded "order + 2 days". Additive — no row altered. Safe to re-run.
ALTER TABLE payment_config
  ADD COLUMN IF NOT EXISTS delivery_ref_km   integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS delivery_ref_days integer NOT NULL DEFAULT 2;
