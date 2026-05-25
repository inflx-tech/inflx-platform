-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 061 — Phase A10: feature catalog + tier_features + subscription_prices
--
-- The first-class subscription model the founder asked for:
--
--   features              — master catalog of gateable capabilities (13 seeded)
--   tier_features         — many-to-many: which features each tier includes,
--                           with per-tier quota override + jsonb config
--                           (for discover_filter + open_group_broadcast)
--   subscription_prices   — one row per (tier × billing_period)
--                           Monthly seeded from current M060 prices; yearly
--                           rows seeded inactive (admin sets value via UI)
--
-- + brand_subscriptions gets a subscription_price_id column so the active
--   subscription knows its billing cadence.
--
-- + backfill: every active brand_subscriptions row points at its tier's
--   monthly price.
--
-- Additive + idempotent (CREATE … IF NOT EXISTS, ALTER … ADD COLUMN IF
-- NOT EXISTS, INSERT … ON CONFLICT DO NOTHING).
--
-- Per-brand override (brand_feature_overrides table) is intentionally NOT
-- in this migration — deferred to A14 per founder decision.
--
-- Contract: features/billing-tier-features-and-prices/.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── ENUMS ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE feature_type AS ENUM ('boolean', 'quota', 'config', 'baseline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE feature_category AS ENUM ('influencer', 'campaigns', 'products', 'brand_store', 'support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_period AS ENUM ('monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 1. features (master catalog) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS features (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key     varchar(60)       UNIQUE NOT NULL,
  label           varchar(120)      NOT NULL,
  category        feature_category  NOT NULL,
  feature_type    feature_type      NOT NULL,
  unit            varchar(20),                          -- 'count'|'per_cycle'|'per_month' (nullable for boolean/baseline/config)
  default_quota   numeric(10,2),                        -- nullable for non-quota types
  is_enforced     boolean           NOT NULL DEFAULT false,  -- flip true per-feature in A12 when wiring real gates
  active          boolean           NOT NULL DEFAULT true,
  sort_order      int               NOT NULL DEFAULT 0,
  description     text,
  created_at      timestamptz       NOT NULL DEFAULT now(),
  updated_at      timestamptz       NOT NULL DEFAULT now(),
  updated_by      uuid              REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_features_category ON features (category, sort_order);

DO $$ BEGIN
  CREATE TRIGGER features_updated_at
    BEFORE UPDATE ON features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: 13 catalog rows (founder-confirmed 2026-05-25)
INSERT INTO features (feature_key, label, category, feature_type, unit, default_quota, sort_order, description) VALUES
  ('discover_filter',           'Discover filter',                'influencer',  'config',   NULL,        NULL,  1, 'Limits which influencers a brand can see by niche and area'),
  ('search_filters_advanced',   'Advanced search filters',        'influencer',  'boolean',  NULL,        NULL,  2, 'Access to collaboration history + engagement-tier filters on top of basic search'),
  ('bulk_outreach',             'Bulk influencer outreach',       'influencer',  'boolean',  NULL,        NULL,  3, 'Send invitations to many influencers in one action'),
  ('invitations_per_cycle',     'Influencer invitations per cycle','influencer', 'quota',    'per_cycle', 5,     4, 'Max number of influencer invites a brand can issue per subscription cycle'),
  ('open_group_broadcast',      'Open-group campaign broadcast',  'influencer',  'config',   NULL,        NULL,  5, 'Publish a campaign as open-group with area scope + recipient cap'),
  ('active_campaigns',          'Active campaigns',               'campaigns',   'quota',    'count',     1,     6, 'Max simultaneously active campaigns'),
  ('sets_per_campaign',         'Sets per campaign',              'campaigns',   'quota',    'count',     1,     7, 'Max influencer sets a brand can create within one campaign'),
  ('products_in_store',         'Products in store',              'products',    'quota',    'count',     10,    8, 'Max active product listings visible to followers'),
  ('media_gallery_items',       'Media gallery items',            'products',    'quota',    'count',     20,    9, 'Max images/videos uploadable to a brand gallery'),
  ('multi_branch_support',      'Multi-branch support',           'brand_store', 'boolean',  NULL,        NULL,  10, 'Manage multiple physical branches under one brand account'),
  ('self_serve_onboarding',     'Self-serve onboarding',          'support',     'baseline', NULL,        NULL,  11, 'Default account creation flow available to everyone'),
  ('dedicated_onboarding_call', 'Dedicated onboarding call',      'support',     'boolean',  NULL,        NULL,  12, 'One-on-one onboarding call with INFLX team at sign-up'),
  ('phone_support_24x7',        '24x7 phone support',             'support',     'boolean',  NULL,        NULL,  13, 'Round-the-clock phone support hotline')
ON CONFLICT (feature_key) DO NOTHING;

-- ── 2. tier_features (entitlement mapping) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS tier_features (
  tier_id       uuid           NOT NULL REFERENCES subscription_tiers(id) ON DELETE CASCADE,
  feature_id    uuid           NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  included      boolean        NOT NULL DEFAULT false,
  quota_value   numeric(10,2),                                                      -- nullable; only for quota-type features. -1 = unlimited.
  config        jsonb          NOT NULL DEFAULT '{}'::jsonb,                        -- for config-type features (discover_filter, open_group_broadcast)
  notes         text,
  updated_at    timestamptz    NOT NULL DEFAULT now(),
  updated_by    uuid           REFERENCES users(id),
  PRIMARY KEY (tier_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_tier_features_tier ON tier_features (tier_id) WHERE included = true;

DO $$ BEGIN
  CREATE TRIGGER tier_features_updated_at
    BEFORE UPDATE ON tier_features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: default tier × feature mapping per founder draft.
-- For each tier_key + feature_key combo we insert exactly one row.
-- Self-serve onboarding (baseline) is included on every tier.
-- Boolean features: explicit included=true/false per tier.
-- Quota features: included=true with quota_value (-1 = unlimited).
-- Config features: included=true with a jsonb config blob.

INSERT INTO tier_features (tier_id, feature_id, included, quota_value, config, notes)
SELECT t.id, f.id,
       CASE WHEN t.tier_key IN ('growth','pro','enterprise') THEN true ELSE false END,
       NULL,
       jsonb_build_object(
         'area_scope', CASE t.tier_key WHEN 'free' THEN 'city' WHEN 'growth' THEN 'state' ELSE 'all_india' END,
         'niches_limit', CASE t.tier_key WHEN 'free' THEN 3 WHEN 'growth' THEN 10 ELSE -1 END
       ),
       'Default seed — admin edits in UI'
  FROM subscription_tiers t, features f
 WHERE f.feature_key = 'discover_filter'
   AND t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- discover_filter is "included on every tier" but the config differs.
-- Override above: included on all tiers (Free included with restricted config).
UPDATE tier_features SET included = true
 WHERE feature_id = (SELECT id FROM features WHERE feature_key = 'discover_filter');

-- search_filters_advanced
INSERT INTO tier_features (tier_id, feature_id, included, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'search_filters_advanced'),
       CASE WHEN t.tier_key IN ('growth','pro','enterprise') THEN true ELSE false END,
       'Default seed'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- bulk_outreach
INSERT INTO tier_features (tier_id, feature_id, included, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'bulk_outreach'),
       CASE WHEN t.tier_key IN ('growth','pro','enterprise') THEN true ELSE false END,
       'Default seed'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- invitations_per_cycle (quota)
INSERT INTO tier_features (tier_id, feature_id, included, quota_value, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'invitations_per_cycle'),
       true,
       CASE t.tier_key WHEN 'free' THEN 5 WHEN 'growth' THEN 25 WHEN 'pro' THEN 100 WHEN 'enterprise' THEN -1 END,
       'Default seed'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- open_group_broadcast (config)
INSERT INTO tier_features (tier_id, feature_id, included, config, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'open_group_broadcast'),
       CASE WHEN t.tier_key IN ('growth','pro','enterprise') THEN true ELSE false END,
       jsonb_build_object(
         'area_scope', CASE t.tier_key WHEN 'free' THEN 'city' WHEN 'growth' THEN 'city' WHEN 'pro' THEN 'state' ELSE 'all_india' END,
         'max_recipients', CASE t.tier_key WHEN 'free' THEN 0 WHEN 'growth' THEN 25 WHEN 'pro' THEN 100 WHEN 'enterprise' THEN -1 END
       ),
       'Default seed'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- active_campaigns (quota — backfill from existing max_campaigns column)
INSERT INTO tier_features (tier_id, feature_id, included, quota_value, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'active_campaigns'),
       true,
       t.max_campaigns,
       'Default seed — backfilled from M058 max_campaigns'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- sets_per_campaign (quota — backfill)
INSERT INTO tier_features (tier_id, feature_id, included, quota_value, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'sets_per_campaign'),
       true,
       t.max_sets_per_campaign,
       'Default seed — backfilled from M058 max_sets_per_campaign'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- products_in_store (quota — backfill)
INSERT INTO tier_features (tier_id, feature_id, included, quota_value, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'products_in_store'),
       true,
       t.max_products,
       'Default seed — backfilled from M058 max_products'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- media_gallery_items (quota — new, no backfill source; founder draft defaults)
INSERT INTO tier_features (tier_id, feature_id, included, quota_value, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'media_gallery_items'),
       true,
       CASE t.tier_key WHEN 'free' THEN 20 WHEN 'growth' THEN 200 WHEN 'pro' THEN 1000 WHEN 'enterprise' THEN -1 END,
       'Default seed'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- multi_branch_support (boolean — pro + enterprise only)
INSERT INTO tier_features (tier_id, feature_id, included, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'multi_branch_support'),
       CASE WHEN t.tier_key IN ('pro','enterprise') THEN true ELSE false END,
       'Default seed'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- self_serve_onboarding (baseline — every tier)
INSERT INTO tier_features (tier_id, feature_id, included, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'self_serve_onboarding'),
       true,
       'Baseline — included on every tier'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- dedicated_onboarding_call (pro + enterprise)
INSERT INTO tier_features (tier_id, feature_id, included, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'dedicated_onboarding_call'),
       CASE WHEN t.tier_key IN ('pro','enterprise') THEN true ELSE false END,
       'Default seed'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- phone_support_24x7 (enterprise only)
INSERT INTO tier_features (tier_id, feature_id, included, notes)
SELECT t.id, (SELECT id FROM features WHERE feature_key = 'phone_support_24x7'),
       CASE WHEN t.tier_key = 'enterprise' THEN true ELSE false END,
       'Default seed'
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- ── 3. subscription_prices ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_prices (
  id                uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id           uuid             NOT NULL REFERENCES subscription_tiers(id) ON DELETE CASCADE,
  billing_period    billing_period   NOT NULL,
  price_inr         numeric(10,2)    NOT NULL CHECK (price_inr >= 0),
  active            boolean          NOT NULL DEFAULT true,
  sort_order        int              NOT NULL DEFAULT 0,
  created_at        timestamptz      NOT NULL DEFAULT now(),
  updated_at        timestamptz      NOT NULL DEFAULT now(),
  updated_by        uuid             REFERENCES users(id),
  UNIQUE (tier_id, billing_period)
);

CREATE INDEX IF NOT EXISTS idx_sub_prices_tier ON subscription_prices (tier_id, active);

DO $$ BEGIN
  CREATE TRIGGER subscription_prices_updated_at
    BEFORE UPDATE ON subscription_prices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: one monthly price per tier from existing subscription_tiers.monthly_price_inr.
-- Yearly rows are NOT seeded — admin adds them via UI when ready (default inactive shape implied).
INSERT INTO subscription_prices (tier_id, billing_period, price_inr, active, sort_order)
SELECT t.id, 'monthly'::billing_period, t.monthly_price_inr, true, 1
  FROM subscription_tiers t
 WHERE t.tier_key IN ('free','growth','pro','enterprise')
ON CONFLICT (tier_id, billing_period) DO NOTHING;

-- ── 4. brand_subscriptions: add subscription_price_id column + backfill ─────

ALTER TABLE brand_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_price_id uuid REFERENCES subscription_prices(id);

CREATE INDEX IF NOT EXISTS idx_brand_subs_price ON brand_subscriptions (subscription_price_id);

-- Backfill: every existing active subscription points at its tier's monthly price.
UPDATE brand_subscriptions bs
   SET subscription_price_id = (
     SELECT sp.id
       FROM subscription_prices sp
      WHERE sp.tier_id = bs.tier_id
        AND sp.billing_period = 'monthly'
        AND sp.active = true
      LIMIT 1
   )
 WHERE bs.subscription_price_id IS NULL
   AND bs.status = 'active';

COMMIT;
