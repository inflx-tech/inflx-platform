-- Migration 032: Brand public contact columns
-- Additive only — no column drops or table drops.
--
-- Adds the two brand-level contact fields the BrandContactAction source_fields
-- in contracts-v1.1.md need to resolve. `users.phone` is the brand owner's
-- login phone (auth credential) — not safe to expose to followers. These
-- columns hold the publishable, follower-facing business contact numbers.
--
-- E.164 format: '+' + country code + subscriber number, max 15 digits total
-- (matches users.phone and follower_orders.whatsapp_number conventions).

ALTER TABLE brands ADD COLUMN IF NOT EXISTS phone          varchar(15);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS whatsapp_phone varchar(15);

COMMENT ON COLUMN brands.phone          IS 'Public business contact phone (E.164). Used by BrandContactAction action="call". Distinct from users.phone (the brand owner login phone).';
COMMENT ON COLUMN brands.whatsapp_phone IS 'Public business WhatsApp number (E.164). Used by BrandContactAction action="whatsapp". May equal phone for many brands.';
