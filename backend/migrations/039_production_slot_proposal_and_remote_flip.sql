-- 039: Production coordination — slot proposal + mutual remote-flip.
--
-- The old flow was brand-first: brand sets address + date + time, influencer
-- accepts or counter-proposes. This wasted round-trips because the brand had
-- to guess the influencer's availability.
--
-- New flow:
--   - Brand sets location-only (address + contact + window). visit_scheduled_at
--     starts NULL.
--   - Influencer fills the slot (date + time) — recorded with
--     slot_proposed_by='influencer'.
--   - Brand accepts → status=confirmed. Or brand counter-proposes a new slot
--     (slot_proposed_by flips to 'brand') and ball is back in influencer's
--     court. Either side can cap at 2 counters before admin escalation.
--
-- Mutual remote-flip: when a visit just won't work, either side can request
-- to flip the production_mode to 'remote' (no shoot, content from brief
-- alone). The other side confirms, contracts.production_mode becomes
-- 'remote', and the production_event auto-completes.

ALTER TABLE production_events
  ADD COLUMN IF NOT EXISTS slot_proposed_by TEXT
    CHECK (slot_proposed_by IS NULL OR slot_proposed_by IN ('brand', 'influencer'));

ALTER TABLE production_events
  ADD COLUMN IF NOT EXISTS remote_flip_requested_by TEXT
    CHECK (remote_flip_requested_by IS NULL OR remote_flip_requested_by IN ('brand', 'influencer'));

ALTER TABLE production_events
  ADD COLUMN IF NOT EXISTS remote_flip_requested_at TIMESTAMPTZ;
