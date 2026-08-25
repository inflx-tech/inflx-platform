-- 159_campaign_set_channels.sql
-- Contract: features/stage-2-build-a-campaign-from-the-phone (slice 2)
-- Board: 04-preview/mockups/stage2-screens.html panel ⑤ · action ledger #69
--
-- THE GAP
-- On a CONTENT set the brand buys labour, so it can reasonably say "1 reel + 2 stories" —
-- that is campaign_sets.formats_json and it already works. On a SALES set the creator only
-- earns if she sells, so dictating post counts is both unfair and unenforceable. The
-- ledger's answer (#69) is to ask the opposite question: which channels will she drive
-- traffic on, and how many should she have.
--
-- Nothing like that exists. Searched all of backend/src and all 158 migrations before
-- writing this: the only occurrence of the word "channel" in the collaboration code is a
-- COMMENT in collabTerms.model.js. No column, no field, no validation.
--
-- WHY IT LIVES ON THE SET AND NOT ON THE AGREEMENT
-- What a particular creator brings is already hers — it belongs to her profile and to
-- what she agreed. This is the brand's statement of who FITS this set: "creators here
-- should have at least two of Instagram, YouTube, WhatsApp or their INFLX shop." It is a
-- property of the set, alongside formats_json which it mirrors.
--
-- GUIDANCE, NOT A GATE — and that is deliberate
-- It blocks no invite, no publish and no sale. A brand has already shaken hands with
-- these creators; refusing to brief someone because she is one channel short would
-- invalidate a negotiation that both sides completed. The screen says so in words:
-- "it doesn't block anyone you've already agreed with."
--
-- SHAPE
--   { "allowed": ["instagram","youtube","whatsapp","inflx_shop"], "minimum": 2 }
-- JSONB rather than two columns because the allowed list is a set that will grow (the
-- ledger's Stage 7 adds Facebook, X and LinkedIn as link channels), and adding a value to
-- a JSON array needs no migration while adding an enum member does.
--
-- Additive only. Nullable, no default, no CHECK constraint — an existing row cannot be
-- rejected, and no backfill is possible or wanted: NULL means "this set never stated a
-- channel expectation", which is true of every set that exists today.

BEGIN;

ALTER TABLE campaign_sets
  ADD COLUMN IF NOT EXISTS channels_json jsonb;

COMMENT ON COLUMN campaign_sets.channels_json IS
  'Sales/hybrid sets only: which channels a creator in this set may drive traffic on, and how many she should have. Shape { allowed: text[], minimum: int }. GUIDANCE — blocks no invite, no publish and no sale, because the creators here already agreed terms. NULL = never stated. The mirror of formats_json, which asks the content question. See features/stage-2-build-a-campaign-from-the-phone.';

COMMIT;

-- Post-migration check (informational):
--   SELECT count(*) AS total, count(channels_json) AS stated FROM campaign_sets;
--   -- expect stated = 0 until a set is built from the phone.
