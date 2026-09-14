-- 182 — Item 6: negotiation (snapshot turns, stamped rounds, outcomes), the move request, the
-- brand-level pool, and the admin platform settings with their audit.
-- Contract: features/item6-negotiation · rules v1.18 §7B, §25 · gap report §5 · APPROVAL §4.1
--
-- Additive. No backfill: production holds zero negotiations, zero turns and zero deferred rows.
-- Every admin number is COPIED onto the thing it governs when that thing is created (§7B):
-- round_limit onto the negotiation, lifetime_days onto the pool entry, min_shoppable_posts onto
-- the invitation. A later change never moves a live collaboration.
BEGIN;

-- ── The negotiation ────────────────────────────────────────────────────────────
ALTER TABLE negotiations
  ADD COLUMN IF NOT EXISTS round_limit          int,
  ADD COLUMN IF NOT EXISTS outcome              text,
  ADD COLUMN IF NOT EXISTS ended_at             timestamptz,
  ADD COLUMN IF NOT EXISTS ended_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  -- the reminders (§25 "Needs You with reminders"): when the move last changed hands, and
  -- which reminders have gone to the side that owes the reply. Reset on every turn.
  ADD COLUMN IF NOT EXISTS turn_changed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_48h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_7d_sent_at  timestamptz;
DO $$ BEGIN
  ALTER TABLE negotiations ADD CONSTRAINT negotiations_outcome_check
    CHECK (outcome IS NULL OR outcome IN ('agreed', 'declined_by_creator', 'declined_by_brand', 'expired', 'moved'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE negotiations ADD CONSTRAINT negotiations_round_limit_check
    CHECK (round_limit IS NULL OR (round_limit BETWEEN 1 AND 5));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── A turn: the whole negotiable set for the Aim, a kind, and the decline fields ──
ALTER TABLE negotiation_turns
  ADD COLUMN IF NOT EXISTS kind           text NOT NULL DEFAULT 'counter',
  ADD COLUMN IF NOT EXISTS terms_json     jsonb,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS decline_note   text;
DO $$ BEGIN
  ALTER TABLE negotiation_turns ADD CONSTRAINT negotiation_turns_kind_check
    CHECK (kind IN ('counter', 'accept', 'decline'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_negotiation_turns_neg ON negotiation_turns (negotiation_id, created_at);

-- ── The move request lives on the invitation, beside item 4's deferred_* columns ──
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS move_requested_at   timestamptz,
  ADD COLUMN IF NOT EXISTS move_answer         text,
  ADD COLUMN IF NOT EXISTS move_answered_at    timestamptz,
  -- the minimum shoppable posts stamped at send (§7B "copied onto the invitation")
  ADD COLUMN IF NOT EXISTS min_shoppable_posts int,
  -- the pool entry this invitation was sent from (N17's line)
  ADD COLUMN IF NOT EXISTS pool_entry_id       uuid;
DO $$ BEGIN
  ALTER TABLE campaign_influencers ADD CONSTRAINT campaign_influencers_move_answer_check
    CHECK (move_answer IS NULL OR move_answer IN ('agreed', 'kept', 'declined'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- 'pool' joins item 5's source vocabulary.
ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS campaign_influencers_source_check;
ALTER TABLE campaign_influencers ADD CONSTRAINT campaign_influencers_source_check
  CHECK (source IS NULL OR source IN ('brand_picker', 'group', 'pitch', 'open_group', 'legacy', 'pool'));

-- ── The pool: brand-level, its own table (gap report §8) ────────────────────────
CREATE TABLE IF NOT EXISTS brand_creator_pool (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  influencer_id       uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  goal                text NOT NULL CHECK (goal IN ('conversion', 'engagement', 'hybrid')),
  agreed_terms_json   jsonb NOT NULL,
  wants_go_live_date  date,
  wants_shoot_mode    text CHECK (wants_shoot_mode IS NULL OR wants_shoot_mode IN ('visit', 'shipment', 'remote')),
  note                text,
  from_campaign_id    uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  from_set_id         uuid REFERENCES campaign_sets(id) ON DELETE SET NULL,
  from_ci_id          uuid REFERENCES campaign_influencers(id) ON DELETE SET NULL,
  agreed_at           timestamptz NOT NULL DEFAULT now(),
  lifetime_days       int NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  state               text NOT NULL DEFAULT 'waiting'
                      CHECK (state IN ('waiting', 'used', 'removed_by_brand', 'removed_by_creator', 'expired')),
  used_ci_id          uuid REFERENCES campaign_influencers(id) ON DELETE SET NULL,
  state_changed_at    timestamptz,
  state_changed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  closing_notified_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_pool_brand_state ON brand_creator_pool (brand_id, state, expires_at);
CREATE INDEX IF NOT EXISTS idx_pool_creator_state ON brand_creator_pool (influencer_id, state);
CREATE INDEX IF NOT EXISTS idx_pool_due ON brand_creator_pool (expires_at) WHERE state = 'waiting';
DO $$ BEGIN
  ALTER TABLE campaign_influencers ADD CONSTRAINT campaign_influencers_pool_entry_fk
    FOREIGN KEY (pool_entry_id) REFERENCES brand_creator_pool(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Platform settings: keyed rows, plus the audit ──────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key        text PRIMARY KEY,
  value      int NOT NULL,
  min_value  int NOT NULL,
  max_value  int NOT NULL,
  unit       text NOT NULL,
  label      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CHECK (value BETWEEN min_value AND max_value)
);
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
  ('negotiation_rounds',  2,  1,  5, 'rounds', 'Negotiation rounds'),
  ('pool_lifetime_days', 30,  7, 90, 'days',   'Pool entry lifetime'),
  ('min_shoppable_posts', 1,  1, 10, 'post',   'Minimum shoppable posts')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS platform_settings_audit (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL REFERENCES platform_settings(key),
  old_value  int,
  new_value  int NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_settings_audit_at ON platform_settings_audit (changed_at DESC);

COMMENT ON COLUMN negotiations.round_limit IS 'Item 6: the admin rounds setting copied here when the negotiation started. Never changes afterwards.';
COMMENT ON COLUMN negotiations.outcome IS 'Item 6: agreed · declined_by_creator · declined_by_brand · expired (with the invitation at the set cutoff) · moved (to the pool). Null while open.';
COMMENT ON COLUMN negotiation_turns.terms_json IS 'Item 6: the WHOLE negotiable term set for the Aim in item 5''s normalised shape; the invitation is turn zero; changes are derived on read.';
COMMENT ON COLUMN campaign_influencers.move_requested_at IS 'Item 6: the creator asked for a different date/mode (deferred_* carry what). The status is untouched until the brand answers.';
COMMENT ON COLUMN campaign_influencers.move_answer IS 'Item 6: the brand''s answer — agreed (→ status deferred + a pool entry), kept (invitation carries on), declined (→ rejected_by_brand). Once per invitation.';
COMMENT ON COLUMN campaign_influencers.min_shoppable_posts IS 'Item 6: the admin minimum stamped at send. Read by the creator''s screen and copied into the agreement (item 7).';
COMMENT ON TABLE brand_creator_pool IS 'Item 6: creators who agreed terms with the brand but not the shape of the set. Brand-level. A note only: never blocks an invitation. A used entry stays used.';
COMMENT ON TABLE platform_settings IS 'Item 6: the admin numbers the rules depend on. Never retroactive: each is copied onto what it governs at creation.';

COMMIT;
