-- 082_meals_offer_recommended.sql
-- INFLX Meals — flag the AI's best-pick offer(s).
-- Contract: features/meals-offer-multi-suggest-modify-chat/.
--
-- The AI now generates MULTIPLE offer combinations across all party sizes
-- and marks the strongest 1–2 as `recommended`. This adds the single
-- column that flag rides on. Additive + idempotent (zero regression):
-- existing rows default to false.

ALTER TABLE meal_offer_rules
  ADD COLUMN IF NOT EXISTS recommended boolean DEFAULT false;
