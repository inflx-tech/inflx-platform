# item6-negotiation — impact

**Verdict: production-impacting.** One migration (182, additive, no backfill), one negotiation service
that the legacy routes now go through, sixteen new endpoints, one cron job deleted and one added, two
OTA bundles (brand and influencer) and one new admin page on Vercel. Explicit go required before
migrate / push / OTA.

## Database (migration 182, additive)
- `negotiations` gains `round_limit`, `outcome` (CHECK `agreed | declined_by_creator |
  declined_by_brand | expired | moved`), `ended_at`, `ended_by`, `turn_changed_at`,
  `reminder_48h_sent_at`, `reminder_7d_sent_at`.
- `negotiation_turns` gains `kind` (`counter | accept | decline`), `terms_json`, `decline_reason`,
  `decline_note`, and `idx_negotiation_turns_neg`.
- `campaign_influencers` gains `move_requested_at`, `move_answer`, `move_answered_at`,
  `min_shoppable_posts`, `pool_entry_id`, and `pool` joins item 5's `source` CHECK.
- New `brand_creator_pool` (brand-level, with `state`, `expires_at`, the agreed `terms_json`, the
  wanted date and mode) and `platform_settings` / `platform_settings_audit`, seeded with the three
  settings at their defaults (rounds 2, pool lifetime 30 days, shoppable posts 1).
- **No backfill.** The production dry run (14 Sep 2026) reports 0 negotiations, 0 turns, 0 deferred
  rows, 8 invitations, 0 campaigns with the switch off, and none of the sixteen columns or three
  tables present. `node backend/scripts/run-182.js --dry` prints the before / after counts.

## Backend
- **New:** `services/negotiation.service` (the one door — `counter`, `accept`, `decline`,
  `moveRequest`, `moveAnswer`, `thread`, `endForExpiredSet`, `sendReminders`, the snapshot and the
  derived changes), `services/pool.service`, `services/platformSettings.service` (60-second cache,
  busted on write, one audit row per changed key), `services/negotiationCopy`,
  `controllers/negotiations.controller`, `routes/item6.routes`,
  `jobs/negotiation-housekeeping.job` (hourly at :50 — pool expiry, the seven-day notice, the two
  silence reminders).
- **Deleted:** `jobs/negotiation-expiry.job.js` and its schedule. The 48-hour auto-decline is gone;
  `negotiations.expires_at` is now only ever nulled, and the column and its index stay.
- **Changed:** `controllers/offer.controller` (the legacy `/offers/:id/negotiate` and the
  `/negotiations/*` routes are wrappers over the service, snapshot in `'legacy'` mode; it no longer
  reads `payment_config.allow_commission_negotiation`), `controllers/campaign.controller`
  (`allow_negotiation` changeable at any time, not draft-only), `controllers/campaignSets.controller`
  and `controllers/invitations.controller` (the pool as a picker source; `min_shoppable_posts` stamped
  at send), `services/invitationSend.service` (`source = 'pool'`, `pool_entry_id`, the stamp,
  `markUsed`), `services/invitationRows.service` (the N20 group order with `yourMove` first,
  "Moved to your pool", `counterHiddenReason`, `canMoveRequest`, the pool and from-pool lines),
  `services/invitationAnswer.service`, `services/collabCounts.service` and
  `services/collabStep.service` (`counters_to_answer` driven by `current_turn`, the brand's count
  filtered to its own move), `controllers/brandInbox.controller`, `jobs/set-expiry.job` (closes open
  threads as `expired`, still leaves `deferred` alone), `config/adminCapabilities` (the `settings`
  label now mentions platform settings), `config/platformRules`.
- **Notification keys:** `negotiation.turn`, `negotiation.agreed`, `negotiation.declined`,
  `negotiation.expired`, `negotiation.reminder`, `move.requested`, `move.kept`, `move.declined`,
  `pool.entered`, `pool.closing`, `pool.closed`, `pool.removed`. Nothing writes the retired job's
  keys any more.
- **Behaviour a live user could notice:** asking to move no longer ends the invitation on the spot
  (the defect fixed); no invitation is auto-declined at 48 hours; the negotiation switch can be
  turned on or off after a campaign is published; `payment_config.allow_commission_negotiation` no
  longer silently blocks a counter; the offer-expiry job's brand notification now says the invitation
  passed **the posting date**, which is what that job actually checks, instead of "within 48 hours".
- **The other remaining 48-hour string** is the open-group broadcast in `campaign.controller`, which
  still inserts `offer_expires_at = now() + interval '48 hours'`. That path is unreachable (no screen
  creates an open-group set and production has none) and item 5's approval said to leave it alone, so
  it is reported, not changed.

## Phone
Brand app: `BrandThreadScreen` and `BrandPoolScreen` are new; the campaigns list gains the pool row;
the new-campaign screen and the campaign ⋯ menu gain the switch; the set detail follows the new group
order. Creator app: `CounterScreen`, `MoveRequestScreen` and `ThreadScreen` are new and
`CounterSoonScreen` is deleted; the invitation screen gains the N1 choice sheet, the N19 line and the
from-pool line; the Collabs cards gain the three move endings. New shared
`components/negotiation/{copy6,bits6,sheets6}.js`. All JavaScript; OTA only.

## Websites
One new admin page, `Packages/brand-web/app/admin/settings/platform` (N22), with two `lib/api.js`
methods and a nav entry. No brand-facing web screen changes.

## Tests
Backend `tests/item6-negotiation.test.js` (42 new); mobile `item6Creator.test.js` (10) and
`item6Brand.test.js` (10). One item 4 assertion in `campaigns.test.js` was rewritten because the
switch is no longer draft-only, and item 5's group-order and Counter-navigation assertions were
updated for N20 and N1.

**Full backend suite: 229 failed / 982 passed / 1211**, against the item 5 baseline of
229 / 940 / 1169 — **0 new failures**, 43 new tests, 0 fixed. **Mobile: 479 / 479** (baseline 459).
