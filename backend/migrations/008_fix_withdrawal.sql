-- 008_fix_withdrawal.sql
-- Add razorpay_contact_id column to influencers table for payout flow
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS razorpay_contact_id VARCHAR(255);
