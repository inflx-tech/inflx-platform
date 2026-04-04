-- Migration 012: Add OneSignal player ID column to users table
-- Replaces/supplements fcm_token for push notifications via OneSignal

ALTER TABLE users
ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;

-- Index for fast lookup when sending pushes by user
CREATE INDEX IF NOT EXISTS idx_users_onesignal_player_id
ON users (onesignal_player_id)
WHERE onesignal_player_id IS NOT NULL;

COMMENT ON COLUMN users.onesignal_player_id IS 'OneSignal subscription/player ID for push notifications';
