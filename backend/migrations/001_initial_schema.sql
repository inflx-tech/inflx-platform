-- =============================================================================
-- INFLX — Initial Database Schema  v1.0
-- All tables from Master Spec Section 2
-- Run via: node scripts/migrate.js
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('brand', 'influencer', 'follower', 'admin');
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE admin_role AS ENUM ('superadmin', 'reviewer', 'finance');

CREATE TYPE campaign_status AS ENUM (
  'draft', 'pending_wallet', 'published', 'active', 'live', 'completed', 'cancelled'
);
CREATE TYPE campaign_goal AS ENUM ('engagement', 'conversion', 'hybrid');
CREATE TYPE assignment_mode AS ENUM ('handpick', 'open_group');

CREATE TYPE campaign_influencer_status AS ENUM (
  'invited', 'accepted', 'negotiating', 'contracted', 'active', 'completed', 'declined', 'expired'
);
CREATE TYPE deliverable_type AS ENUM (
  'reel', 'post', 'story', 'youtube_video', 'youtube_short'
);
CREATE TYPE deliverable_status AS ENUM (
  'pending', 'submitted', 'under_review', 'revision_requested', 'approved', 'live'
);
CREATE TYPE negotiation_status AS ENUM (
  'open', 'awaiting_brand', 'awaiting_influencer', 'agreed', 'walked_away'
);
CREATE TYPE turn_sender AS ENUM ('brand', 'influencer');

CREATE TYPE offer_type AS ENUM ('flat', 'percentage', 'bogo', 'bundle', 'volume', 'prebook');
CREATE TYPE wallet_tx_type AS ENUM (
  'topup', 'escrow_lock', 'escrow_release', 'payout', 'refund', 'platform_fee'
);
CREATE TYPE tx_direction AS ENUM ('credit', 'debit');
CREATE TYPE escrow_status AS ENUM (
  'locked', 'queued', 'processing', 'released', 'disputed', 'refunded'
);
CREATE TYPE escrow_trigger AS ENUM ('contract_signed', 'content_live', 'day_30_post_live');

CREATE TYPE follower_tx_type AS ENUM (
  'pay_at_store', 'prebook', 'online_order', 'redirect_click'
);
CREATE TYPE follower_tx_status AS ENUM ('initiated', 'completed', 'returned', 'refunded');
CREATE TYPE order_status AS ENUM ('confirmed', 'dispatched', 'delivered');

CREATE TYPE withdrawal_method AS ENUM ('upi', 'bank_transfer');
CREATE TYPE withdrawal_status AS ENUM ('initiated', 'processing', 'completed', 'failed');

CREATE TYPE veg_flag AS ENUM ('veg', 'non_veg', 'na');
CREATE TYPE booking_status AS ENUM (
  'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled'
);
CREATE TYPE refund_status AS ENUM ('not_applicable', 'initiated', 'completed');
CREATE TYPE lead_status AS ENUM ('submitted', 'viewed', 'responded', 'converted', 'lost');

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER FUNCTION for updated_at
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2.1 — CORE TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- OTP codes (no FK dependencies — standalone lookup table)
CREATE TABLE otp_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      varchar(15) NOT NULL,
  code       varchar(6)  NOT NULL,
  expires_at timestamptz NOT NULL,
  used       bool        DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_otp_phone ON otp_codes (phone, used);

-- 2.1.1 users
CREATE TABLE users (
  id         uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      varchar(15) UNIQUE NOT NULL,                  -- E.164 e.g. +919876543210
  role       user_role  NOT NULL,
  name       varchar(100) NOT NULL,
  email      varchar(200) UNIQUE,
  status     user_status DEFAULT 'pending',
  city       varchar(60),
  state      varchar(60),
  fcm_token  text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Refresh tokens (stored hashed; HttpOnly cookie holds the raw token)
CREATE TABLE refresh_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  varchar(64) NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked     bool        DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- Admin profiles (admin_role stored here, not in users table)
CREATE TABLE admin_profiles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  admin_role  admin_role  NOT NULL,
  created_by  uuid        REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

-- 2.1.2 brands
CREATE TABLE brands (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  business_name        varchar(150) NOT NULL,
  category             varchar(60)  NOT NULL,
  gstin                varchar(20),
  address_line         text,
  pincode              varchar(10),
  wallet_balance       numeric(12,2) DEFAULT 0,
  platform_fee_pct     numeric(5,2)  DEFAULT 8.00,
  razorpay_contact_id  varchar(100),
  logo_url             text,
  rejection_reason     text,
  approved_at          timestamptz,
  approved_by          uuid         REFERENCES users(id),
  created_at           timestamptz  DEFAULT now(),
  updated_at           timestamptz  DEFAULT now()
);
CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2.1.3 influencers
CREATE TABLE influencers (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  instagram_handle  varchar(60) UNIQUE NOT NULL,
  youtube_handle    varchar(60),
  followers_count   int,
  engagement_rate   numeric(5,2),
  niche             varchar(60)[],
  language          varchar(30)[],
  content_style     varchar(60),
  bank_account_no   text,                -- AES-256-GCM encrypted
  bank_ifsc         varchar(12),
  upi_id            text,                -- AES-256-GCM encrypted
  pan_number        text,                -- AES-256-GCM encrypted
  wallet_balance    numeric(12,2) DEFAULT 0,
  pending_balance   numeric(12,2) DEFAULT 0,
  total_earned      numeric(12,2) DEFAULT 0,
  scrape_data       jsonb,
  scrape_last_run   timestamptz,
  rejection_reason  text,
  approved_at       timestamptz,
  approved_by       uuid         REFERENCES users(id),
  created_at        timestamptz  DEFAULT now(),
  updated_at        timestamptz  DEFAULT now()
);
CREATE TRIGGER influencers_updated_at
  BEFORE UPDATE ON influencers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2.1.4 followers (default_address_id FK added later — circular dependency)
CREATE TABLE followers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  default_address_id uuid             -- FK constraint added after follower_addresses
);

-- 2.1.5 follower_follows
CREATE TABLE follower_follows (
  follower_id    uuid NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  influencer_id  uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  followed_at    timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, influencer_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2.2 — CAMPAIGN TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.2.1 campaigns
CREATE TABLE campaigns (
  id           uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     uuid            NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name         varchar(150)    NOT NULL,
  brief        text,                          -- Campaign content brief (Phase 3: contract content_requirements)
  status       campaign_status DEFAULT 'draft',
  total_budget numeric(12,2),
  start_date   date,
  end_date     date,
  created_at   timestamptz     DEFAULT now(),
  published_at timestamptz,
  live_at      timestamptz,
  completed_at timestamptz
);
CREATE INDEX idx_campaigns_brand ON campaigns (brand_id, status);

-- 2.2.2 campaign_sets
CREATE TABLE campaign_sets (
  id                 uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        uuid             NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name               varchar(100)     NOT NULL,
  goal               campaign_goal,
  assignment_mode    assignment_mode,
  budget             numeric(12,2),
  open_group_slots   int,
  content_start_date date,
  content_end_date   date,
  filters_json       jsonb
);

-- 2.2.3 campaign_influencers
CREATE TABLE campaign_influencers (
  id               uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id           uuid                       NOT NULL REFERENCES campaign_sets(id) ON DELETE CASCADE,
  influencer_id    uuid                       NOT NULL REFERENCES influencers(id),
  status           campaign_influencer_status DEFAULT 'invited',
  agreed_fee       numeric(10,2),
  posting_date     date,
  coupon_code      varchar(40) UNIQUE,
  commission_pct   numeric(5,2),
  offer_expires_at timestamptz,
  declined_reason  varchar(100),
  contract_signed_at timestamptz,
  brand_signed_at    timestamptz,
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX idx_ci_influencer ON campaign_influencers (influencer_id, status);

-- 2.2.4 deliverables
CREATE TABLE deliverables (
  id                       uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_influencer_id   uuid               NOT NULL REFERENCES campaign_influencers(id) ON DELETE CASCADE,
  type                     deliverable_type   NOT NULL,
  quantity                 int                DEFAULT 1,
  status                   deliverable_status DEFAULT 'pending',
  submission_deadline      date,
  submitted_url            text,
  submitted_at             timestamptz,       -- Phase 3: when influencer submitted
  notes_to_brand           text,              -- Phase 3: influencer message on submit
  live_url                 text,
  live_confirmed_at        timestamptz,
  revision_count           int DEFAULT 0,
  revision_limit           int DEFAULT 2,
  brand_feedback           text,
  caption_draft            text
);

-- Deliverable stats (populated by Apify cron — Phase 5)
CREATE TABLE deliverable_stats (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id  uuid           NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  reach           bigint         DEFAULT 0,
  impressions     bigint         DEFAULT 0,
  likes           bigint         DEFAULT 0,
  comments        bigint         DEFAULT 0,
  saves           bigint         DEFAULT 0,
  shares          bigint         DEFAULT 0,
  engagement_rate numeric(5,2),
  scraped_at      timestamptz    DEFAULT now(),
  UNIQUE(deliverable_id)
);

-- 2.2.5 negotiations
CREATE TABLE negotiations (
  id                       uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_influencer_id   uuid               NOT NULL REFERENCES campaign_influencers(id) ON DELETE CASCADE UNIQUE,
  initiated_by             uuid               NOT NULL REFERENCES users(id),
  status                   negotiation_status DEFAULT 'open',
  current_turn             turn_sender,
  agreed_fee               numeric(10,2),
  agreed_deadline          date,
  created_at               timestamptz DEFAULT now()
);

-- 2.2.6 negotiation_turns
CREATE TABLE negotiation_turns (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id   uuid        NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
  sent_by          turn_sender NOT NULL,
  proposed_fee     numeric(10,2),
  proposed_deadline date,
  note             text,
  created_at       timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2.3 — PRODUCT & OFFER TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.3.1 brand_products
CREATE TABLE brand_products (
  id            uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid       NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name          varchar(150) NOT NULL,
  category_key  varchar(60),
  price         numeric(10,2),
  image_url     text,
  is_stock_image bool      DEFAULT false,
  veg_flag      veg_flag   DEFAULT 'na',
  variants_json jsonb,
  duration_mins int,
  is_active     bool       DEFAULT true,
  section       varchar(80),
  ai_imported   bool       DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- 2.3.2 campaign_offers
CREATE TABLE campaign_offers (
  id               uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid       NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  set_id           uuid       REFERENCES campaign_sets(id),
  offer_type       offer_type NOT NULL,
  discount_value   numeric(8,2),
  products_json    jsonb,
  availing_modes   text[],
  bundle_price     numeric(10,2),
  volume_threshold int,
  prebook_advance  numeric(8,2),
  is_active        bool       DEFAULT true
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2.4 — FINANCIAL TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.4.1 wallet_transactions
CREATE TABLE wallet_transactions (
  id                   uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id             uuid           NOT NULL REFERENCES brands(id),
  type                 wallet_tx_type NOT NULL,
  amount               numeric(12,2)  NOT NULL,
  direction            tx_direction   NOT NULL,
  balance_after        numeric(12,2),
  campaign_id          uuid           REFERENCES campaigns(id),
  razorpay_payment_id  varchar(80),
  notes                text,
  created_at           timestamptz    DEFAULT now()
);
CREATE INDEX idx_wallet_tx_brand ON wallet_transactions (brand_id, created_at DESC);

-- 2.4.2 escrow_entries
CREATE TABLE escrow_entries (
  id                       uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_influencer_id   uuid           NOT NULL REFERENCES campaign_influencers(id),
  tranche_number           int            NOT NULL CHECK (tranche_number IN (1, 2, 3)),
  amount                   numeric(10,2)  NOT NULL,
  platform_fee_amount      numeric(8,2),
  net_to_influencer        numeric(10,2),
  status                   escrow_status  DEFAULT 'locked',
  trigger_event            escrow_trigger,
  triggered_at             timestamptz,
  released_at              timestamptz,
  razorpay_payout_id       varchar(80)
);

-- 2.5 — Follower addresses (must be before follower_transactions)
CREATE TABLE follower_addresses (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid      NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  label       varchar(30),
  line1       text      NOT NULL,
  line2       text,
  city        varchar(60),
  pincode     varchar(10),
  is_default  bool      DEFAULT false
);

-- Now add the circular FK on followers
ALTER TABLE followers
  ADD CONSTRAINT fk_followers_default_address
  FOREIGN KEY (default_address_id)
  REFERENCES follower_addresses(id)
  ON DELETE SET NULL;

-- 2.4.3 follower_transactions
CREATE TABLE follower_transactions (
  id                       uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id              uuid              NOT NULL REFERENCES followers(id),
  brand_id                 uuid              NOT NULL REFERENCES brands(id),
  campaign_id              uuid              REFERENCES campaigns(id),
  set_id                   uuid              REFERENCES campaign_sets(id),
  campaign_influencer_id   uuid              REFERENCES campaign_influencers(id),
  offer_id                 uuid              REFERENCES campaign_offers(id),
  transaction_type         follower_tx_type  NOT NULL,
  gross_amount             numeric(10,2),
  discount_amount          numeric(10,2),
  net_amount               numeric(10,2),
  influencer_commission    numeric(8,2),
  platform_fee             numeric(8,2),
  brand_net                numeric(10,2),
  status                   follower_tx_status DEFAULT 'initiated',
  razorpay_payment_id      varchar(80),
  order_status             order_status,
  return_window_ends_at    timestamptz,
  commission_confirmed_at  timestamptz,
  coupon_code_used         varchar(40),
  created_at               timestamptz       DEFAULT now()
);
CREATE INDEX idx_ft_influencer ON follower_transactions (campaign_influencer_id, status);

-- 2.4.4 influencer_withdrawals
CREATE TABLE influencer_withdrawals (
  id                   uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id        uuid              NOT NULL REFERENCES influencers(id),
  amount_requested     numeric(10,2)     NOT NULL,
  tds_deducted         numeric(8,2),
  net_paid             numeric(10,2),
  method               withdrawal_method NOT NULL,
  upi_id               text,
  bank_account_no      text,
  bank_ifsc            varchar(12),
  razorpay_payout_id   varchar(80),
  status               withdrawal_status DEFAULT 'initiated',
  created_at           timestamptz       DEFAULT now(),
  completed_at         timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2.5 — FOLLOWER APP TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.5.2 follower_orders
CREATE TABLE follower_orders (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id          uuid         NOT NULL REFERENCES follower_transactions(id),
  address_id              uuid         REFERENCES follower_addresses(id),
  order_status            order_status DEFAULT 'confirmed',
  estimated_delivery_date date,
  dispatched_at           timestamptz,
  delivered_at            timestamptz,
  whatsapp_number         varchar(15),
  items_json              jsonb,
  created_at              timestamptz  DEFAULT now()
);

-- 2.5.3 follower_bookings
CREATE TABLE follower_bookings (
  id                    uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id        uuid           NOT NULL REFERENCES follower_transactions(id),
  booking_date          date           NOT NULL,
  booking_time          time           NOT NULL,
  guest_count           int,
  reference_code        varchar(20)    UNIQUE,
  status                booking_status DEFAULT 'confirmed',
  advance_paid          numeric(8,2),
  balance_due_at_venue  numeric(8,2),
  cancelled_at          timestamptz,
  refund_status         refund_status  DEFAULT 'not_applicable',
  created_at            timestamptz    DEFAULT now()
);

-- 2.5.4 enquiry_leads
CREATE TABLE enquiry_leads (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id              uuid        NOT NULL REFERENCES followers(id),
  brand_id                 uuid        NOT NULL REFERENCES brands(id),
  campaign_influencer_id   uuid        REFERENCES campaign_influencers(id),
  form_data_json           jsonb,
  status                   lead_status DEFAULT 'submitted',
  deal_value               numeric(12,2),
  commission_triggered     bool        DEFAULT false,
  created_at               timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6 — NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       varchar(60) NOT NULL,
  title      varchar(100) NOT NULL,
  body       text        NOT NULL,
  data_json  jsonb,
  is_read    bool        DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7 — CONTRACTS TABLE (Phase 3)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE contract_status AS ENUM (
  'pending_influencer', 'pending_brand', 'active', 'disputed'
);

CREATE TABLE contracts (
  id                     uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_influencer_id uuid            NOT NULL REFERENCES campaign_influencers(id) ON DELETE CASCADE UNIQUE,
  influencer_fee         numeric(10,2),
  revision_limit         int             DEFAULT 2,
  posting_date           date,
  content_requirements   text,
  brand_name             varchar(150),
  influencer_name        varchar(100),
  campaign_name          varchar(150),
  influencer_signed_at   timestamptz,
  influencer_signed_name varchar(100),
  brand_signed_at        timestamptz,
  brand_signed_by        uuid            REFERENCES users(id),
  pdf_url                text,
  status                 contract_status DEFAULT 'pending_influencer',
  created_at             timestamptz     DEFAULT now(),
  updated_at             timestamptz     DEFAULT now()
);
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_contracts_ci ON contracts (campaign_influencer_id);
