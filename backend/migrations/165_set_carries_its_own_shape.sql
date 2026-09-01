-- 165 — A set carries its own go-live day, shoot mode and invitation deadline.
-- Contract: features/stage-a-the-set
-- Design:   features/screen-atlas (mockup-locked 2026-09-01) — SB-26, SB-27
--
-- THE GAP
-- The locked design says: a set is ONE AIM, ONE GO-LIVE DAY, ONE WAY OF SHOOTING.
-- Money settles inside a set; a day or a shoot mode cannot, because other creators
-- already agreed to them — so disagreeing about either MOVES HER OUT (Stage B).
--
-- Of those three, only the aim exists today: campaign_sets.goal, the campaign_goal
-- enum from 001 ('engagement' | 'conversion' | 'hybrid'), already read by
-- services/deliverables.model.js buysContent(). The other two do not exist at all.
--
-- WHAT IS HERE TOODAY, AND WHY IT IS NOT ENOUGH
--   window_start / window_end   a RANGE she may post within (migration 002)
--   content_start/end_date      dead — never written; 0 of 11 rows have it
--
-- A window is not a go-live day. The founder, 2026-08-29:
--   "post by date is one where all social posts of creators in that set go live on
--    that date.....so all commission,content and both go live in that date"
-- Everyone in the set posts on ONE day. She cannot beat it and cannot miss it.
-- A range cannot express that, which is why this is a new column and not a rename.
--
-- NO BACKFILL — DELIBERATELY
-- The plan proposed filling go_live_date from window_end. Production says no:
--   campaign_sets rows ............ 11
--   with window_end set ........... 2
--   with window_start set ......... 7
--   contracts with production_mode  1 of 6 ('visit'; five null)
-- Deriving a launch day for nine live sets from a column that is null would be
-- inventing dates for real campaigns. So nothing is rewritten. A set with
-- go_live_date IS NULL is a PRE-SET-FIRST set and the existing window fallback
-- keeps serving it, exactly as it does now. The wizard requires the field going
-- forward; history is left alone.
--
-- SHOOT MODE — TWO ON THE SCREEN, THREE IN THE CODE
-- production_mode has carried three values since 024:
--   visit      she comes to the store        BOTH mark it done
--   shipment   you send her the products     she alone
--   remote     nothing sent, she works from your images    she alone
-- The atlas draws two and calls the second "remote", but everything Book 3
-- describes under that name — her address, tracking, "everything arrived" — is
-- SHIPMENT. Founder's decision 2026-09-01: the wizard offers two, and the second
-- one stores 'shipment'. The CHECK below permits 'remote' as well, because the
-- older brand-approve flow can still set it and six live contracts resolve their
-- mode through that path. What the CHECK prevents is a fourth value appearing.
--
-- Additive, nullable, no defaults, IF NOT EXISTS throughout. No existing row can
-- be made invalid by this migration; it is safe to re-run.

BEGIN;

ALTER TABLE campaign_sets
  ADD COLUMN IF NOT EXISTS go_live_date     date,
  ADD COLUMN IF NOT EXISTS shoot_mode       text,
  ADD COLUMN IF NOT EXISTS invites_close_at date;

COMMENT ON COLUMN campaign_sets.go_live_date IS
  'The ONE day every creator in this set posts on social media. Not a deadline she '
  'can beat and not one she can miss — the whole set launches together. Shop posts '
  'on INFLX have no deadline of their own; they only have to be APPROVED by this '
  'day. NULL means a pre-set-first set: fall back to window_start/window_end.';

COMMENT ON COLUMN campaign_sets.shoot_mode IS
  'How every creator in this set shoots. visit = she comes to the store, and BOTH '
  'sides mark it done. shipment = the brand sends the products, and SHE ALONE marks '
  'it done. remote = nothing is sent; reachable only by the older brand-approve '
  'flow, never offered by the set wizard. NULL means a pre-set-first set: the mode '
  'resolves from the contract, then the agreement, as productionMode.model.js '
  'already does.';

COMMENT ON COLUMN campaign_sets.invites_close_at IS
  'After this day no more invitations go out for this set. Sits before go_live_date '
  'by enough to sign and shoot. NULL on pre-set-first sets.';

-- Guard the vocabulary, not the presence. NULL stays legal — every one of the 11
-- live rows has NULL here and must remain valid.
DO $$ BEGIN
  ALTER TABLE campaign_sets
    ADD CONSTRAINT campaign_sets_shoot_mode_known
    CHECK (shoot_mode IS NULL OR shoot_mode IN ('visit', 'shipment', 'remote'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- A set that launches before invitations close cannot be delivered. Both NULL on
-- every live row, so this constrains new sets only.
DO $$ BEGIN
  ALTER TABLE campaign_sets
    ADD CONSTRAINT campaign_sets_invites_close_before_go_live
    CHECK (invites_close_at IS NULL OR go_live_date IS NULL
           OR invites_close_at <= go_live_date);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
