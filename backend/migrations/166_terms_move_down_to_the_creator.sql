-- 166 — What she posts and what she makes move down from the set to the creator.
-- Contract: features/stage-a-the-set
-- Design:   features/screen-atlas (mockup-locked 2026-09-01) — SB-29, SB-30, SC-05
--
-- THE GAP
-- SB-30 "Her terms" is the screen that replaces the entire second brief: what she
-- earns, what she can sell, her offer, WHERE SHE POSTS, and WHAT SHE MAKES — all
-- on one screen, all per creator, all read back to her verbatim on SC-05.
--
-- Most of it already exists on campaign_influencers. Checked before writing:
--   commission_pct, agreed_fee ................ what she earns          ✓
--   alloc_scope, alloc_category,
--   alloc_category_node_id, alloc_product_ids . what she can sell       ✓
--   brand_offer_id, offer_valid_from/until,
--   offer_type, offer_config_json ............. her offer               ✓
--   delivery_address .......................... her shipping address    ✓
--
-- Two are missing, and both are missing for the same reason: they are on the SET.
--   campaign_sets.channels_json   (migration 159)
--   campaign_sets.formats_json    (migration 002)
--
-- WHY THEY BELONG TO HER
-- 159 put channels on the set deliberately, and its reasoning was sound at the time:
-- the set states who FITS — "creators here should have at least two of Instagram,
-- YouTube, WhatsApp". That is a filter on who to invite.
--
-- Set-first asks a different question. Book 4, CR-15, from the founder:
--   "not go live on instagram.....its live on social media...next these should be
--    matched with his agreed social media list"
-- Going live is checked PER CHANNEL against the channels SHE agreed — and two
-- creators in one set can agree to different channels. A set-level list cannot
-- express that, and BR-19 cannot know when to release her tranche 2 without it.
--
-- The same argument applies to formats_json: "1 reel + 2 stories" is what THIS
-- creator owes, and SB-29 exists precisely so the brand can set a default for the
-- set and then override one person.
--
-- NOTHING IS MOVED OR COPIED
-- The set keeps both columns. This migration only ADDS the creator-level pair,
-- nullable and with no default. Reading order becomes:
--     her value  ->  else the set's value  ->  else nothing
-- so every row in flight keeps resolving exactly as it does today, and a set-level
-- value stays meaningful as the DEFAULT that SB-29 offers.
--
-- Copying the set's values down would look tidier and would be wrong: it would turn
-- 8 live campaign_influencers rows from "inherits the set" into "explicitly chose
-- this", and the brand never chose it. Inheritance is the honest state.
--
-- Additive, nullable, IF NOT EXISTS. No existing row can be made invalid. Re-runnable.

BEGIN;

ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS channels_json jsonb,
  ADD COLUMN IF NOT EXISTS formats_json  jsonb;

COMMENT ON COLUMN campaign_influencers.channels_json IS
  'The channels THIS creator agreed to post on, as set on SB-30 and read back to '
  'her on SC-05. Going live (CR-15) is checked per channel against this list, and '
  'BR-19 releases her second tranche only when every one of them is confirmed. '
  'NULL means she inherits campaign_sets.channels_json — that is the normal state '
  'for a set where everyone posts the same places, and it is what all 8 live rows '
  'do today.';

COMMENT ON COLUMN campaign_influencers.formats_json IS
  'What THIS creator makes — "1 reel, 2 stories". NULL means she inherits '
  'campaign_sets.formats_json. Only meaningful when the set buys content: '
  'buysContent(goal) is the single answer to that, and a sale-only set legitimately '
  'has an empty list on both levels. Sending [] for a sale set was read as an error '
  'by the server once already; the aim decides, not the emptiness of this column.';

COMMIT;
