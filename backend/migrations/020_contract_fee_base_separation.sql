-- 020_contract_fee_base_separation.sql
-- Phase 5 introduced a 'bonus' on top of the agreed fee but the approveContract
-- endpoint OVERWROTE contracts.influencer_fee with (base + bonus). The intent
-- was always for influencer_fee to remain the base agreed amount and for the
-- total to be derived as influencer_fee + bonus_amount on demand.
--
-- This migration:
--   1. Restores influencer_fee = (current_value - bonus_amount) for any contract
--      where the brand actually approved a bonus, returning influencer_fee to
--      the original base.
--   2. Going forward, contract.controller.approveContract no longer touches
--      influencer_fee — it only writes bonus_amount. See the matching code
--      change shipped with this migration.
--
-- Idempotent: running twice is safe because we only adjust rows where
-- bonus_amount > 0 AND influencer_fee currently includes that bonus
-- (detectable by approved_at being set, which means the overwrite happened).

BEGIN;

UPDATE contracts
SET    influencer_fee = GREATEST(0, influencer_fee - bonus_amount)
WHERE  bonus_amount  > 0
  AND  approved_at IS NOT NULL
  AND  influencer_fee >= bonus_amount;     -- safety: avoid negative fees

COMMIT;
