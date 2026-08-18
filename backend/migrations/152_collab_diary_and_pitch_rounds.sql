-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 152 — the collaboration diary, and rounds on a creator's pitch
-- Contract: features/collab-phase0-foundations  (Phase 0 of the collab programme)
--
-- THE GAP — 1: NOTHING REMEMBERS A NEGOTIATION
-- Kanchi Silks asks Asha for 15% by 24 Aug. Asha counters 22% by 2 Sep. Kanchi
-- counters 18% by 28 Aug. Asha accepts.
--
-- Afterwards the system knows they settled 18% / 28 Aug, that each side used one
-- counter, and when each message was sent, seen and answered. It does NOT know
-- Kanchi ever offered 15%, or that Asha ever asked 22% — brand_collab_requests
-- .counter_terms_json and influencer_proposals.counter_terms each hold only THE
-- LATEST counter, and every new one overwrites the last.
--
-- The same hole exists twice more: a post sent back twice keeps only the second
-- reason (creator_posts.reject_reason), and a reel that went two rounds keeps only
-- the second request (deliverables.brand_feedback).
--
-- The shoot is the exception. production_event_log records every action with actor
-- and timestamp, which is why the shoot is the only step that can settle an
-- argument. This table generalises that pattern to all six steps.
--
-- THE GAP — 2: A CREATOR CANNOT COUNTER BACK ON HER OWN PITCH
-- brand_collab_requests carries brand_rounds_used / creator_rounds_used /
-- counter_by, so a brand-initiated conversation is a real two-way negotiation.
-- influencer_proposals carries none of them: the brand may counter (unbounded),
-- and the creator's only replies are accept or decline. These three columns make
-- the pitch direction symmetric.
--
-- Additive + idempotent. No column dropped, renamed or retyped.
-- NO BACKFILL OF HISTORY: the diary starts the day it ships. What was overwritten
-- is gone, and inventing it would put fiction on a screen two people use to settle
-- disagreements.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. The diary ────────────────────────────────────────────────────────────
-- One row per thing that happened, on any step, in either direction.
--
-- Anchoring is deliberately plural. Step 1 lives on a request or a pitch (no
-- campaign exists yet); steps 2-6 live on a campaign_influencer; the agreement
-- sits between them. At least one anchor is required, so an entry can always be
-- found from whichever end the reader starts at.
CREATE TABLE IF NOT EXISTS collab_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Anchors. At least one must be set; more than one is normal and useful —
  -- an acceptance belongs to both the request and the agreement it produced.
  request_id              uuid REFERENCES brand_collab_requests(id)  ON DELETE CASCADE,
  proposal_id             uuid REFERENCES influencer_proposals(id)   ON DELETE CASCADE,
  agreement_id            uuid REFERENCES collab_agreements(id)      ON DELETE CASCADE,
  campaign_influencer_id  uuid REFERENCES campaign_influencers(id)   ON DELETE CASCADE,

  -- A shop post is the odd one out. creator_posts carries NO campaign_influencer_id —
  -- deliberately, because a post belongs to the creator and may span several brands or
  -- her whole shelf. So a step-4 event anchors to the post itself; when the post happens
  -- to be exclusive to one collaboration the caller may set campaign_influencer_id too,
  -- and a mixed-brand post simply has no collaboration to name.
  post_id                 uuid REFERENCES creator_posts(id)          ON DELETE CASCADE,

  CONSTRAINT collab_events_needs_an_anchor CHECK (
    request_id IS NOT NULL OR proposal_id IS NOT NULL
    OR agreement_id IS NOT NULL OR campaign_influencer_id IS NOT NULL
    OR post_id IS NOT NULL
  ),

  -- Which of the six steps this happened on:
  --   1 agree · 2 sign · 3 shoot · 4 shop posts · 5 go live · 6 complete
  step                    smallint NOT NULL CHECK (step BETWEEN 1 AND 6),

  actor_role              text NOT NULL CHECK (actor_role IN ('brand','creator','admin','system')),
  actor_user_id           uuid REFERENCES users(id) ON DELETE SET NULL,

  -- What they did. Free-form by step rather than one global enum, because the
  -- vocabularies genuinely differ — 'dispatched' means nothing on step 1.
  action                  text NOT NULL,

  -- The terms as they stood AFTER this action. Lets any entry be read on its own.
  terms_snapshot          jsonb,

  -- What moved, as { field: { from, to } }. This is the information: an entry
  -- saying "countered" is not worth reading; "15% -> 22%" is.
  changed                 jsonb,

  -- Human text where one exists: a decline reason, a rejection fault, a note.
  note                    text,

  -- Round accounting at the moment of the action, so a reader can see
  -- "your 1st of 2" without recomputing it.
  round_of                smallint,
  round_max               smallint,

  meta                    jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Read paths: "show me this conversation" and "show me this collaboration".
CREATE INDEX IF NOT EXISTS idx_collab_events_request
  ON collab_events (request_id, created_at) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collab_events_proposal
  ON collab_events (proposal_id, created_at) WHERE proposal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collab_events_agreement
  ON collab_events (agreement_id, created_at) WHERE agreement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collab_events_post
  ON collab_events (post_id, created_at) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collab_events_ci
  ON collab_events (campaign_influencer_id, step, created_at) WHERE campaign_influencer_id IS NOT NULL;

COMMENT ON TABLE collab_events IS
  'The collaboration diary (mig 152, Phase 0). One row per action on any of the six steps, either direction. Generalises production_event_log, which was the only step that recorded anything. Entries store WHAT CHANGED, not that something did. Starts empty and is never backfilled — history that was overwritten before this shipped is genuinely gone.';
COMMENT ON COLUMN collab_events.changed IS
  'What moved, as { field: { from, to } }. The point of the diary: "15% -> 22%" rather than "countered".';
COMMENT ON COLUMN collab_events.terms_snapshot IS
  'Terms as they stood AFTER this action, so any entry can be read standalone without replaying the ones before it.';

-- ── 2. Rounds on a creator's pitch ──────────────────────────────────────────
-- Mirrors brand_collab_requests exactly, so the two directions cannot drift on
-- what a round means.
ALTER TABLE influencer_proposals
  ADD COLUMN IF NOT EXISTS brand_rounds_used    integer NOT NULL DEFAULT 0;
ALTER TABLE influencer_proposals
  ADD COLUMN IF NOT EXISTS creator_rounds_used  integer NOT NULL DEFAULT 0;
ALTER TABLE influencer_proposals
  ADD COLUMN IF NOT EXISTS counter_by           text;

ALTER TABLE influencer_proposals
  DROP CONSTRAINT IF EXISTS influencer_proposals_counter_by_check;
ALTER TABLE influencer_proposals
  ADD CONSTRAINT influencer_proposals_counter_by_check
  CHECK (counter_by IS NULL OR counter_by IN ('brand','creator'));

COMMENT ON COLUMN influencer_proposals.counter_by IS
  'Who sent the latest counter: brand | creator. Until mig 152 only a brand could counter a pitch, so counter_terms was unambiguously theirs. With the creator able to counter back, the column that says whose it is becomes load-bearing — brand acceptance settles the LATEST terms, and nobody may accept their own counter.';
COMMENT ON COLUMN influencer_proposals.counter_terms IS
  'The latest counter, WHOEVER sent it — read counter_by to know. Matches brand_collab_requests.counter_terms_json.';

-- ── 3. Backfill — a statement of fact, not a guess ──────────────────────────
-- Until this migration nobody but a brand could counter a pitch, so any pitch
-- already carrying counter_terms was countered by the brand, once.
UPDATE influencer_proposals
   SET counter_by        = 'brand',
       brand_rounds_used = GREATEST(brand_rounds_used, 1)
 WHERE counter_terms IS NOT NULL
   AND counter_by IS NULL;

COMMIT;

-- Post-migration checks (informational):
--   SELECT count(*) FROM collab_events;                                  -- 0, by design
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'influencer_proposals'
--      AND column_name IN ('brand_rounds_used','creator_rounds_used','counter_by');   -- 3 rows
--   SELECT count(*) FROM influencer_proposals WHERE counter_terms IS NOT NULL AND counter_by IS NULL;  -- 0
