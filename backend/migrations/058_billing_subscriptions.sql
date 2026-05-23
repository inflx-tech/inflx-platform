-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 058 — INFLX Revenue Model schema (Phase A1)
--
-- Adds the L1 (SaaS subscription) + L3 (path-based marketplace fee) +
-- attribution tables for the 3-layer revenue model. L2 (escrow fee tiers)
-- was delivered by M037 (escrow_fee_tiers) and is reused as-is.
--
-- Tables:
--   subscription_tiers      — admin-editable L1 tier catalog (4 seeded rows)
--   brand_subscriptions     — one active sub per brand (lazy-created in A4)
--   subscription_invoices   — L1 invoice history with GST
--   categories              — admin-editable L3 fee % per category × path (16 seeded)
--   attribution_clicks      — 30-day Path-C attribution window
--
-- Enums:
--   subscription_status, mandate_status, invoice_status, attribution_path
--
-- Money convention: all monetary columns numeric(10,2) RUPEES per CLAUDE.md.
-- Idempotent: IF NOT EXISTS + DO $$ EXCEPTION WHEN duplicate_object
-- + ON CONFLICT DO NOTHING. Safe to re-run.
--
-- Additive only — no existing table touched. Contract:
-- features/billing-subscriptions-schema/.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── ENUMS ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'cancelled', 'past_due');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mandate_status AS ENUM ('pending', 'active', 'paused', 'cancelled', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attribution_path AS ENUM ('direct', 'influencer_direct', 'influencer_attributed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 1. subscription_tiers (L1 catalog, admin-editable) ──────────────────────

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key                    varchar(40)   UNIQUE NOT NULL,
  name                        varchar(80)   NOT NULL,
  monthly_price_inr           numeric(10,2) NOT NULL,
  max_campaigns               int           NOT NULL DEFAULT 0,
  max_sets_per_campaign       int           NOT NULL DEFAULT 0,
  max_influencers_per_cycle   int           NOT NULL DEFAULT 0,
  max_products                int           NOT NULL DEFAULT 0,
  is_enterprise               bool          NOT NULL DEFAULT false,
  active                      bool          NOT NULL DEFAULT true,
  sort_order                  int           NOT NULL DEFAULT 0,
  description                 text,
  updated_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_by                  uuid          REFERENCES users(id),
  CHECK (monthly_price_inr >= 0),
  CHECK (max_campaigns             = -1 OR max_campaigns             >= 0),
  CHECK (max_sets_per_campaign     = -1 OR max_sets_per_campaign     >= 0),
  CHECK (max_influencers_per_cycle = -1 OR max_influencers_per_cycle >= 0),
  CHECK (max_products              = -1 OR max_products              >= 0)
);

DO $$ BEGIN
  CREATE TRIGGER subscription_tiers_updated_at
    BEFORE UPDATE ON subscription_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: 4 admin-editable tier rows. Placeholder values from the brief's
-- Glow Studio walkthrough; founder may edit any column via admin UI
-- (Phase A7) and the next renewal cycle picks up the new price.
INSERT INTO subscription_tiers
  (tier_key,    name,         monthly_price_inr, max_campaigns, max_sets_per_campaign, max_influencers_per_cycle, max_products, is_enterprise, sort_order, description)
VALUES
  ('free',       'Free',           0.00,    1,   1,   5,    10,  false, 1, 'Starter plan — 1 campaign, 10 products, 5 influencers per cycle.'),
  ('growth',     'Growth',      2499.00,    3,   3,  25,   100,  false, 2, '₹2,499/mo — 3 campaigns, 100 products, 25 influencers per cycle.'),
  ('pro',        'Pro',         9999.00,   10,  10, 100,   500,  false, 3, '₹9,999/mo — 10 campaigns, 500 products, 100 influencers per cycle.'),
  ('enterprise', 'Enterprise', 29999.00,   -1,  -1,  -1,    -1,  true,  4, '₹29,999/mo — custom limits, unlimited everything.')
ON CONFLICT (tier_key) DO NOTHING;

-- ── 2. brand_subscriptions (one active sub per brand) ────────────────────────

CREATE TABLE IF NOT EXISTS brand_subscriptions (
  id                       uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                 uuid                  NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  tier_id                  uuid                  NOT NULL REFERENCES subscription_tiers(id),
  status                   subscription_status   NOT NULL DEFAULT 'active',
  current_cycle_start      date                  NOT NULL,
  current_cycle_end        date                  NOT NULL,
  next_charge_at           date,
  razorpay_subscription_id varchar(80),
  razorpay_mandate_id      varchar(80),
  mandate_status           mandate_status        DEFAULT 'pending',
  last_charged_at          timestamptz,
  cancelled_at             timestamptz,
  cancel_reason            text,
  notes                    text,
  created_at               timestamptz           NOT NULL DEFAULT now(),
  updated_at               timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_subs_brand
  ON brand_subscriptions (brand_id, status);

CREATE INDEX IF NOT EXISTS idx_brand_subs_next_charge
  ON brand_subscriptions (next_charge_at)
  WHERE status = 'active';

-- At most one active subscription per brand (partial unique).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_brand_subs_active
  ON brand_subscriptions (brand_id)
  WHERE status = 'active';

DO $$ BEGIN
  CREATE TRIGGER brand_subscriptions_updated_at
    BEFORE UPDATE ON brand_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. subscription_invoices (L1 invoice history with GST) ──────────────────

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id                       uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_subscription_id    uuid             NOT NULL REFERENCES brand_subscriptions(id) ON DELETE CASCADE,
  brand_id                 uuid             NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  tier_key                 varchar(40)      NOT NULL,                   -- denormalized (tier may rename)
  amount_inr               numeric(10,2)    NOT NULL,                   -- excl GST
  gst_amount_inr           numeric(10,2)    NOT NULL DEFAULT 0,         -- 18% IGST default
  total_inr                numeric(10,2)    GENERATED ALWAYS AS (amount_inr + gst_amount_inr) STORED,
  period_start             date             NOT NULL,
  period_end               date             NOT NULL,
  razorpay_payment_id      varchar(80),
  razorpay_invoice_id      varchar(80),
  status                   invoice_status   NOT NULL DEFAULT 'pending',
  failure_reason           text,
  paid_at                  timestamptz,
  invoice_pdf_r2_key       text,
  created_at               timestamptz      NOT NULL DEFAULT now(),
  updated_at               timestamptz      NOT NULL DEFAULT now(),
  CHECK (amount_inr      >= 0),
  CHECK (gst_amount_inr  >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sub_invoices_brand
  ON subscription_invoices (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sub_invoices_status
  ON subscription_invoices (status, created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER subscription_invoices_updated_at
    BEFORE UPDATE ON subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. categories (L3 marketplace-fee catalog, admin-editable) ──────────────

CREATE TABLE IF NOT EXISTS categories (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key  varchar(50)   UNIQUE NOT NULL,
  name          varchar(120)  NOT NULL,
  label         varchar(120)  NOT NULL,
  path_a_pct    numeric(5,2)  NOT NULL CHECK (path_a_pct >= 0 AND path_a_pct <= 50),
  path_b_pct    numeric(5,2)  NOT NULL CHECK (path_b_pct >= 0 AND path_b_pct <= 50),
  path_c_pct    numeric(5,2)  NOT NULL CHECK (path_c_pct >= 0 AND path_c_pct <= 50),
  active        bool          NOT NULL DEFAULT true,
  sort_order    int           NOT NULL DEFAULT 0,
  description   text,
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  updated_by    uuid          REFERENCES users(id)
);

DO $$ BEGIN
  CREATE TRIGGER categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: 16 admin-editable category rows with PLACEHOLDER A/B/C percentages.
-- Founder may edit any value via admin UI (Phase A7); changes take effect
-- on the NEXT follower_transaction (cache TTL ~60s, same pattern as M037).
INSERT INTO categories
  (category_key,      name,                label,              path_a_pct, path_b_pct, path_c_pct, sort_order, description)
VALUES
  ('salon_beauty',    'salon_beauty',      'Salon & Beauty',         9.00,       5.00,       7.00,         1, 'Hair / spa / beauty services'),
  ('restaurant',      'restaurant',        'Restaurant',             8.00,       4.00,       6.00,         2, 'Dine-in / pay-at-store'),
  ('fashion',         'fashion',           'Fashion',               10.00,       5.00,       7.00,         3, 'Apparel / accessories'),
  ('car_rental',      'car_rental',        'Car Rental',             8.00,       4.00,       6.00,         4, 'Vehicle rentals'),
  ('packaged_food',   'packaged_food',     'Packaged Food',          9.00,       5.00,       7.00,         5, 'Branded / packaged food'),
  ('florist',         'florist',           'Florist',               10.00,       5.00,       7.00,         6, 'Flower / bouquet'),
  ('wedding_planner', 'wedding_planner',   'Wedding Planner',       10.00,       5.00,       7.00,         7, 'Event / wedding planning'),
  ('function_hall',   'function_hall',     'Function Hall',         10.00,       5.00,       7.00,         8, 'Banquet / event venue'),
  ('gym_fitness',     'gym_fitness',       'Gym & Fitness',          8.00,       4.00,       6.00,         9, 'Gym / fitness studio'),
  ('travel_hotel',    'travel_hotel',      'Travel & Hotel',         9.00,       5.00,       7.00,        10, 'Hotel / travel booking'),
  ('electronics',     'electronics',       'Electronics',            8.00,       4.00,       6.00,        11, 'Consumer electronics'),
  ('jewellery',       'jewellery',         'Jewellery',              8.00,       4.00,       6.00,        12, 'Jewellery retail'),
  ('footwear',        'footwear',          'Footwear',               8.00,       4.00,       6.00,        13, 'Footwear retail'),
  ('furniture',       'furniture',         'Furniture',              8.00,       4.00,       6.00,        14, 'Furniture retail'),
  ('optical',         'optical',           'Optical',                8.00,       4.00,       6.00,        15, 'Eyewear / opticals'),
  ('home_services',   'home_services',     'Home Services',          8.00,       4.00,       6.00,        16, 'Plumber / electrician / cleaning')
ON CONFLICT (category_key) DO NOTHING;

-- ── 5. attribution_clicks (30-day Path-C window) ────────────────────────────
--
-- WRITE site (Phase A5): backend/src/controllers/transaction.controller.js at
--   follower-transaction time, when the txn carries a valid CI (Path B). At
--   /s/{handle} redirect time the follower is NOT yet authenticated; we
--   cannot legitimately set follower_id without session/device fingerprinting.
--   So tracking.controller continues writing link_clicks only — unchanged.
--
-- READ site (Phase A5): backend/src/services/pricing.service.js classifyPath
--   at follower-transaction time, before computing the L3 fee.
--
-- Lifecycle: upsert on every Path-B transaction (refreshes expires_at to
-- now()+30d); Path-C transactions read most-recent unexpired row by
-- (follower_id, influencer_id); expired rows are inert (Path A falls through).

CREATE TABLE IF NOT EXISTS attribution_clicks (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id     uuid          NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  influencer_id   uuid          NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  brand_id        uuid          REFERENCES brands(id) ON DELETE SET NULL,
  campaign_id     uuid          REFERENCES campaigns(id) ON DELETE SET NULL,
  link_click_id   bigint        REFERENCES link_clicks(id) ON DELETE SET NULL,  -- link_clicks.id is BIGSERIAL (M007)
  expires_at      timestamptz   NOT NULL,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attribution_active
  ON attribution_clicks (follower_id, influencer_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_attribution_expires
  ON attribution_clicks (expires_at);

COMMIT;
