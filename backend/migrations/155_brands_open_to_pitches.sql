-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 155 — approved brands are open to creator pitches
-- Contract: features/stage-1-find-each-other-and-agree  (Stage 1)
--
-- FOUNDER'S DECISION, 2026-08-15, restated 2026-08-22:
--   "Approved brands are OPEN to creator pitches by default. A brand's five filters
--    apply only when that brand explicitly sets them."
--
-- WHY IT IS NEEDED
-- brands.accepts_proposals has defaulted to FALSE since migration 025. Verified against
-- production 2026-08-22: 0 of 5 brands accept pitches. So a creator opening "find brands
-- to pitch" sees nothing, and the whole outbound half of Stage 1 is an empty room. The
-- screens are pointless until this flips.
--
-- THE ASYMMETRY IS DELIBERATE AND STAYS
-- Creators are reachable BY DEFAULT and may mute. Brands used to OPT IN. A creator who
-- cannot be found gets no work; a brand who is not looking should not be pitched — which
-- was the original reasoning. What changed is the judgement that an APPROVED brand has
-- already opted into the platform, and every one of them keeps the switch and all five
-- filters to narrow or close the door again.
--
-- THIS IS THE ONLY OUTWARD-FACING CHANGE IN STAGE 1
-- Brands do not get told. Some will first notice when a pitch notification arrives. That
-- is why it carries its own explicit go on the day, separate from the deploy go.
--
-- REVERSIBLE, two ways:
--   per brand   UPDATE brands SET accepts_proposals = false WHERE id = '…';
--   wholesale   UPDATE brands SET accepts_proposals = false;
--
-- SCOPE: only brands whose USER is approved. A pending or rejected brand is not open to
-- anything, and flipping one would put a creator in a conversation with an account that
-- cannot transact. The column DEFAULT is deliberately left FALSE so a brand that signs up
-- tomorrow is opened by the approval step, not by the act of registering.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE brands b
   SET accepts_proposals = true
  FROM users u
 WHERE u.id = b.user_id
   AND u.status = 'approved'
   AND b.accepts_proposals = false;

COMMENT ON COLUMN brands.accepts_proposals IS
  'Can creators pitch this brand? Approved brands were opened by migration 155 '
  '(Stage 1, founder decision 2026-08-15). The brand may switch it off at any time, '
  'and proposal_filters narrows who may pitch without closing the door. The column '
  'DEFAULT stays FALSE: a new brand is opened when it is APPROVED, not when it registers.';
