-- 038: Apply→Approve flow for open-group invitations.
-- New CI statuses:
--   applied            — influencer wants in; brand hasn't picked yet
--   rejected_by_brand  — brand explicitly turned the application down
--   slots_filled       — campaign reached max_cap before this row was picked
--
-- ALTER TYPE … ADD VALUE is non-transactional in PG, so each value is
-- added via its own statement. IF NOT EXISTS keeps re-runs safe.

ALTER TYPE campaign_influencer_status ADD VALUE IF NOT EXISTS 'applied';
ALTER TYPE campaign_influencer_status ADD VALUE IF NOT EXISTS 'rejected_by_brand';
ALTER TYPE campaign_influencer_status ADD VALUE IF NOT EXISTS 'slots_filled';
