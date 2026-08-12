-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 149 — the pre-campaign handshake
-- Contract: features/collab-part2-precampaign-handshake
--
-- THE GAP
-- Today a creator can pitch a brand (influencer_proposals, 15 endpoints, full
-- lifecycle) but a brand CANNOT approach a creator before a campaign exists. Its
-- only outreach is a campaign invite — which needs a campaign — or an invitation
-- to an unclaimed scraped creator, which needs them to not be on the platform.
--
-- And when a brand accepts a pitch, the code fabricates a campaign to have
-- somewhere to put the result: proposal.controller INSERTs a campaign with only
-- (brand_id, name, status, created_at) — which is why dateless campaigns already
-- exist in production — plus a set, a campaign_influencer and a contract draft.
-- The agreed creator never enters a real campaign.
--
-- THE MODEL (founder, 2026-08-11)
-- Two stages. Stage 1 is a cheap handshake that settles the terms that matter.
-- Stage 2 is the detailed campaign, built afterwards from creators who already
-- agreed. "If brand creates campaign without knowing their interest is waste of
-- energy."
--
-- TWO RECORD TYPES, ONE TERMS MODEL. A creator pitch says "I want to work with
-- you"; a brand request says "I want you for something". Different shapes, so
-- separate tables — but they share the terms payload and the response flow, and
-- both produce the SAME agreement on acceptance. Neither is ever converted into
-- the other.
--
-- Additive only. influencer_proposals is untouched.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Admin-controlled limits ─────────────────────────────────────────────────
-- Founder: "we add these limits not hardcoded, we keep admin control one."
--
-- Today's values live as constants in proposal.service (RATE_LIMITS,
-- PROPOSAL_TTL_DAYS, COOLDOWN_DAYS_AFTER_REJECT), so changing any of them needs a
-- deploy — and the brand side has no limits at all because brand outreach never
-- existed. Both sides move here, seeded with today's numbers so behaviour is
-- unchanged on day one.
--
-- Single-row pattern, same as referral_settings / world_rule_settings /
-- follower_app_config.
CREATE TABLE IF NOT EXISTS handshake_settings (
  id                          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- creator → brand (today's hardcoded values)
  creator_max_active          integer NOT NULL DEFAULT 5,
  creator_max_per_day         integer NOT NULL DEFAULT 3,
  creator_max_per_week        integer NOT NULL DEFAULT 10,

  -- brand → creator (new; a brand runs more conversations than a creator)
  brand_max_active            integer NOT NULL DEFAULT 12,
  brand_max_per_day           integer NOT NULL DEFAULT 10,
  brand_max_per_week          integer NOT NULL DEFAULT 40,

  -- shared
  request_ttl_days            integer NOT NULL DEFAULT 7,
  decline_cooldown_days       integer NOT NULL DEFAULT 30,
  counter_rounds_per_side     integer NOT NULL DEFAULT 2,

  -- the cap that stops bulk outreach becoming spam
  broadcast_max_recipients    integer NOT NULL DEFAULT 30,

  -- founder: an accepted handshake not briefed within three months expires
  agreement_expiry_days       integer NOT NULL DEFAULT 90,

  updated_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  uuid
);

INSERT INTO handshake_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE handshake_settings IS
  'Single-row admin-editable limits for the pre-campaign handshake, BOTH directions. Seeded with the values previously hardcoded in proposal.service. Readers must fall back to those constants if the row is missing, so absence is safe rather than fatal.';

-- ── Creator preferences ─────────────────────────────────────────────────────
-- Founder: creators are reachable BY DEFAULT and can mute. Deliberately
-- asymmetric with brands, who opt in — a brand not looking for creators should not
-- be pitched, but a creator who cannot be found cannot get work.
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS accepts_brand_requests  boolean NOT NULL DEFAULT true;
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS include_in_broadcasts   boolean NOT NULL DEFAULT true;
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS min_commission_pct      numeric(5,2);
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS min_fee                 numeric(10,2);
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS accepted_aims           text[];

COMMENT ON COLUMN influencers.accepts_brand_requests IS
  'Creator mute. Default true — opt-in would leave most creators unreachable and the feature unused. A brand is TOLD the request cannot be sent rather than being silently ignored.';
COMMENT ON COLUMN influencers.include_in_broadcasts IS
  'Separate from the mute: a creator can stay open to a deliberate approach while excluding themselves from filter-matched bulk outreach.';

-- ── Brand → creator requests ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_collab_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES brands(id)      ON DELETE CASCADE,
  influencer_id         uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

  -- The shared terms payload. Same shape the creator pitch uses, validated by one
  -- module so the two sides cannot drift on what a term means.
  --   { aim, money:{...}, time:{...}, scope:{...}, mode:{...},
  --     deliverables:{...}, importance:{ <term>: 'requirement'|'preference' } }
  -- Money and time are always present. Everything else optional, and anything
  -- stated carries an importance marker.
  terms_json            jsonb NOT NULL,
  message               text,

  status                text NOT NULL DEFAULT 'sent',
  -- sent | viewed | countered | agreed | declined | withdrawn | expired

  -- Two counters each, then settle or drop. Tracked per side so both can see how
  -- much room is left rather than guessing.
  brand_rounds_used     integer NOT NULL DEFAULT 0,
  creator_rounds_used   integer NOT NULL DEFAULT 0,
  counter_terms_json    jsonb,          -- the latest counter, whoever sent it
  counter_by            text,           -- 'brand' | 'creator'

  -- How this request was sent, so a brand can see who one broadcast reached.
  origin                text NOT NULL DEFAULT 'direct',   -- direct | group | broadcast
  origin_group_id       uuid REFERENCES influencer_groups(id) ON DELETE SET NULL,
  broadcast_batch_id    uuid,

  expires_at            timestamptz NOT NULL,
  viewed_at             timestamptz,
  responded_at          timestamptz,
  decline_reason        text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bcr_brand     ON brand_collab_requests (brand_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bcr_creator   ON brand_collab_requests (influencer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bcr_broadcast ON brand_collab_requests (broadcast_batch_id) WHERE broadcast_batch_id IS NOT NULL;

COMMENT ON TABLE brand_collab_requests IS
  'Brand -> creator collaboration request, sent BEFORE any campaign exists. The mirror of influencer_proposals, deliberately a separate table: a pitch and a request mean different things and are never converted into one another. They share the terms model and the response flow.';

-- ── Agreements ──────────────────────────────────────────────────────────────
-- What acceptance produces, from EITHER record type. Replaces the fabricated
-- campaign: no campaign, no set, no campaign_influencer, no contract at this point.
CREATE TABLE IF NOT EXISTS collab_agreements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              uuid NOT NULL REFERENCES brands(id)      ON DELETE CASCADE,
  influencer_id         uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,

  -- The settled terms — what both sides actually agreed, after any counters.
  terms_json            jsonb NOT NULL,

  -- Which record produced this. Exactly one is set; the CHECK enforces it so an
  -- agreement can never lose track of where it came from.
  source_request_id     uuid REFERENCES brand_collab_requests(id) ON DELETE SET NULL,
  source_proposal_id    uuid REFERENCES influencer_proposals(id)  ON DELETE SET NULL,
  CONSTRAINT agreement_has_exactly_one_source
    CHECK ((source_request_id IS NOT NULL) <> (source_proposal_id IS NOT NULL)),

  status                text NOT NULL DEFAULT 'ready',   -- ready | consumed | expired | cancelled

  -- Consumed when briefed into a campaign. One agreement is one collaboration,
  -- used once, so "ready to brief" always shows exactly what is outstanding.
  -- Several agreements can still go into ONE campaign across its sets.
  consumed_campaign_id  uuid REFERENCES campaigns(id)             ON DELETE SET NULL,
  consumed_ci_id        uuid REFERENCES campaign_influencers(id)  ON DELETE SET NULL,
  consumed_at           timestamptz,

  expires_at            timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agr_brand   ON collab_agreements (brand_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agr_creator ON collab_agreements (influencer_id, status, created_at DESC);

COMMENT ON TABLE collab_agreements IS
  'Produced by acceptance of either a brand request or a creator pitch. Deliberately NOT a campaign: the old acceptance path fabricated a campaign+set+assignment+contract because it had nowhere else to put the result, which is why one-person dateless campaigns exist in production.';
COMMENT ON COLUMN collab_agreements.status IS
  'ready = waiting to be briefed · consumed = briefed into a campaign · expired = not briefed within handshake_settings.agreement_expiry_days (founder: three months) · cancelled = withdrawn by either side before briefing.';

-- ── Cooldowns, brand direction ──────────────────────────────────────────────
-- proposal_cooldowns already covers creator -> brand. The mirror stops a brand
-- re-asking a creator who declined.
CREATE TABLE IF NOT EXISTS brand_request_cooldowns (
  brand_id       uuid NOT NULL REFERENCES brands(id)      ON DELETE CASCADE,
  influencer_id  uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  cooldown_until timestamptz NOT NULL,
  reason         text,
  PRIMARY KEY (brand_id, influencer_id)
);

-- Link a campaign_influencer back to the agreement it came from, so the creator's
-- campaign acceptance knows the terms were already settled and must hide Negotiate.
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS agreement_id uuid REFERENCES collab_agreements(id) ON DELETE SET NULL;

COMMENT ON COLUMN campaign_influencers.agreement_id IS
  'Set when this assignment was briefed from a handshake agreement. Presence means terms were already negotiated, so the creator gets a single Accept (which generates the contract, as it already does) and NO Negotiate. NULL = invited cold, and today''s Accept/Decline/Negotiate flow is unchanged for them.';

COMMIT;

-- Post-migration checks (informational):
--   SELECT * FROM handshake_settings;                       -- one row, today's values
--   SELECT count(*) FROM brand_collab_requests;             -- 0
--   SELECT count(*) FROM collab_agreements;                 -- 0
