-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 169 — Item 2: brand pitch settings, creator invitation settings,
-- per-industry minimum commissions, blocks, and a mode on creator pitches.
-- Contract: features/item2-pitch-invitation-settings · rules doc v1.10 §8A
-- Gap report: Docs/ITEM2_SETTINGS_GAP_REPORT.md (D1–D3, D5)
--
-- THE GAP
-- A brand could switch pitches on/off and set five filters (brands.accepts_proposals,
-- brands.proposal_filters — mig 025) that are not the §8A fields, were never validated,
-- and were handed to creators by /brands/:id/proposal-criteria. A creator could set
-- nothing: the four columns from mig 149 have no writer. Nobody could block anybody.
--
-- MISSING ROW = ALL DEFAULTS (founder Q7). No backfill. Every brand and creator,
-- existing or new, starts fully open exactly as rules §8A says a new account does.
-- The old columns are left in place, deprecated, and no longer read by eligibility.
--
-- MINIMUMS SURVIVE AN AIM BEING TURNED OFF by construction: the fee columns and the
-- commission rows do not depend on accepted_aims. Readers ignore rows for an Aim or
-- industry the creator has not selected; nothing deletes them.
--
-- Additive + idempotent. No column dropped, renamed or retyped. No row touched.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Brand: who can pitch us ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_pitch_settings (
  brand_id                uuid PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  accepting               boolean NOT NULL DEFAULT true,
  paused_at               timestamptz,
  accepted_aims           text[] NOT NULL DEFAULT ARRAY['conversion','engagement','hybrid']
                          CHECK (cardinality(accepted_aims) >= 1
                             AND accepted_aims <@ ARRAY['conversion','engagement','hybrid']),
  accepted_modes          text[] NOT NULL DEFAULT ARRAY['visit','shipment']
                          CHECK (cardinality(accepted_modes) >= 1
                             AND accepted_modes <@ ARRAY['visit','shipment']),
  niche_codes             text[],                                   -- NULL = any
  min_followers_instagram integer CHECK (min_followers_instagram IS NULL OR min_followers_instagram >= 0),
  min_followers_youtube   integer CHECK (min_followers_youtube   IS NULL OR min_followers_youtube   >= 0),
  min_engagement_rate     numeric(4,1) CHECK (min_engagement_rate IS NULL OR (min_engagement_rate >= 0 AND min_engagement_rate <= 100)),
  language_codes          text[],                                   -- NULL = any
  city_ids                integer[],                                -- NULL = any
  allow_past_creators     boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE brand_pitch_settings IS
  'Rules v1.10 §8A "Brand — who can pitch us". One row per brand, written only by the brand. A missing row means every default (fully open). Only accepting/paused, accepted_aims and accepted_modes are ever shown to a creator; everything else is private.';

-- ── Creator: who can invite me ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_invitation_settings (
  influencer_id           uuid PRIMARY KEY REFERENCES influencers(id) ON DELETE CASCADE,
  open                    boolean NOT NULL DEFAULT true,
  paused_at               timestamptz,
  accepted_aims           text[] NOT NULL DEFAULT ARRAY['conversion','engagement','hybrid']
                          CHECK (cardinality(accepted_aims) >= 1
                             AND accepted_aims <@ ARRAY['conversion','engagement','hybrid']),
  accepted_modes          text[] NOT NULL DEFAULT ARRAY['visit','shipment']
                          CHECK (cardinality(accepted_modes) >= 1
                             AND accepted_modes <@ ARRAY['visit','shipment']),
  -- ≥1 when 'visit' is accepted. Enforced by the PUT handler rather than a CHECK, because
  -- the default for a creator who has never saved is her profile city resolved at read
  -- time (rules: "defaults to the creator's own city") and may be empty until item 3.
  visit_city_ids          integer[] NOT NULL DEFAULT '{}',
  brand_category_codes    text[],                                   -- NULL = any
  min_fee_engagement      integer CHECK (min_fee_engagement IS NULL OR min_fee_engagement >= 0),  -- whole rupees
  min_fee_hybrid          integer CHECK (min_fee_hybrid      IS NULL OR min_fee_hybrid      >= 0),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE creator_invitation_settings IS
  'Rules v1.10 §8A "Creator — who can invite me". One row per creator, written only by the creator. A missing row means every default (fully open). Only open/paused, accepted_aims and accepted_modes are ever shown to a brand.';

-- Minimum commission, per Aim AND per industry (founder: rules v1.9 §8A). category_code is
-- one of the 8 codes or 'ALL'. Rows for a category the creator later unselects, or an
-- Aim she turns off, are KEPT and ignored — the numbers come back when she re-selects.
CREATE TABLE IF NOT EXISTS creator_min_commissions (
  influencer_id  uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  aim            text NOT NULL CHECK (aim IN ('conversion','hybrid')),
  category_code  text NOT NULL,
  pct            numeric(5,2) NOT NULL CHECK (pct >= 1 AND pct <= 100),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (influencer_id, aim, category_code)
);
COMMENT ON TABLE creator_min_commissions IS
  'Soft minimum (warns, never blocks). Read by eligibility for (aim, brand''s sub-category) when the creator picked categories, else (aim, ''ALL''). A missing row = no minimum.';

-- ── Blocks, both directions ──────────────────────────────────────────────────
-- The blocked party is never told and never shown a difference from "paused". No
-- notification is sent on block or unblock. Existing pitches, invitations, negotiations
-- and signed collaborations are untouched (rules §8A: not retroactive).
CREATE TABLE IF NOT EXISTS collab_blocks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_type  text NOT NULL CHECK (blocker_type IN ('brand','creator')),
  blocker_id    uuid NOT NULL,          -- brands.id when blocker_type='brand', influencers.id when 'creator'
  blocked_type  text NOT NULL CHECK (blocked_type IN ('brand','creator')),
  blocked_id    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (blocker_type <> blocked_type),
  UNIQUE (blocker_type, blocker_id, blocked_type, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_collab_blocks_blocked ON collab_blocks (blocked_type, blocked_id);
COMMENT ON TABLE collab_blocks IS
  'A brand blocking a creator stops her pitching it; a creator blocking a brand stops it inviting her. Looks exactly like "paused" to the blocked side.';

-- ── A pitch carries its mode of work ────────────────────────────────────────
-- The brand's accepted modes cannot be enforced on a pitch that does not say which mode
-- it proposes. Optional until item 8 (the pitch flow) makes it mandatory — founder Q11.
ALTER TABLE influencer_proposals ADD COLUMN IF NOT EXISTS shoot_mode text;
ALTER TABLE influencer_proposals DROP CONSTRAINT IF EXISTS influencer_proposals_shoot_mode_known;
ALTER TABLE influencer_proposals ADD CONSTRAINT influencer_proposals_shoot_mode_known
  CHECK (shoot_mode IS NULL OR shoot_mode IN ('visit','shipment'));

-- ── Deprecations (comments only; nothing dropped) ────────────────────────────
COMMENT ON COLUMN brands.accepts_proposals IS
  'DEPRECATED since item 2 (mig 169): eligibility reads brand_pitch_settings.accepting. Left in place, unread by the pitch check.';
COMMENT ON COLUMN brands.proposal_filters IS
  'DEPRECATED since item 2 (mig 169): the five old filters. Never returned to creators any more. Left in place, unread by the pitch check.';
COMMENT ON COLUMN influencers.accepts_brand_requests IS
  'DEPRECATED since item 2 (mig 169): see creator_invitation_settings.open. Never written by any live surface.';
COMMENT ON COLUMN influencers.accepted_aims IS
  'DEPRECATED since item 2 (mig 169): see creator_invitation_settings.accepted_aims.';
COMMENT ON COLUMN influencers.min_fee IS
  'DEPRECATED since item 2 (mig 169): see creator_invitation_settings.min_fee_engagement / min_fee_hybrid.';
COMMENT ON COLUMN influencers.min_commission_pct IS
  'DEPRECATED since item 2 (mig 169): see creator_min_commissions.';

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM brand_pitch_settings;         -- 0, by design (missing row = defaults)
--   SELECT count(*) FROM creator_invitation_settings;  -- 0
--   SELECT count(*) FROM collab_blocks;                -- 0
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='influencer_proposals' AND column_name='shoot_mode';   -- 1 row
