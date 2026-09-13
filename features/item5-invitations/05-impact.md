# item5-invitations — impact

**Verdict: production-impacting.** One migration (181, with a small backfill), one extracted send
service that the legacy brief now goes through, eleven new endpoints, three legacy endpoints changed in
behaviour, two OTA bundles (brand and influencer). Explicit go required before migrate / push / OTA.

## Database (migration 181)
Two enum values (`withdrawn`, `removed`); eleven nullable columns on `campaign_influencers`
(`invited_at`, `answered_at`, `invited_by`, `source`, `source_group_id`, `brand_note`,
`usage_rights_json`, `withdrawn_at/by`, `removed_at/by`); two CHECKs (source vocabulary, note ≤ 300);
the partial unique index `uq_ci_live_per_set` on live rows; `idx_ci_set_created`. **Backfill** on the
eight production rows: `invited_at = created_at`, `source = 'pitch'` (all eight carry an agreement).
Dry run prints the counts and refuses on a live duplicate (production has none).

## Backend
- New: `services/invitationSend.service` (one door for every invitation row; batch send; withdraw;
  remove), `services/invitationTerms.service` (the §7 rules per Aim, strict / legacy), `services/invitationInputs.service`
  (allocation, offer, promoted, formats, channels, coupon — moved out of the controller unchanged),
  `services/invitationAnswer.service` (accept / decline shared by both doors), `services/invitationRows.service`
  (the grouped set, the brand's and the creator's read shapes), `services/invitationCopy` (§7 messages),
  `config/platformRules` (`MIN_SHOPPABLE_POSTS = 1`), `controllers/invitations.controller`,
  `routes/invitation.routes`.
- Changed: `POST …/invite` (now `sendLegacy`; requires a posting date; terms validated in legacy mode),
  `PATCH …/influencers/:ciId` (**refuses every row**), `POST /campaigns/:id/influencers/:ciid/cancel`
  (**is the remove**; it used to write an invalid status and fail), `GET /offers/inbox` and `GET /offers/:id`
  (**budgets, brief, coupon prefix stripped**), `/offers/:id/accept|decline` (shared service; five
  reasons + legacy `already_partnered`; note ≤ 200; `answered_at`; the brand told the reason),
  `GET …/sets/:sid/summary` (+ `creators`), `campaignState` (deferred not waiting; completed needs a
  finished row; `finished` count), `collabOwedItems.DEAD_STATUSES`, `collabState.familyOf`,
  `collabStep`, `collabEligibility` (`minimums`, `canBrandInviteMany`), `brandProducts.list`
  (+ category), `transaction.service.validateTracking` (+ `brand_offer_id`, `offer_valid_from`),
  `transaction.controller` (the sale records the winning offer id), `offerResolution`
  (`creatorOfferNotYetLive`), `follower.service` (not-yet-live offers not advertised).
- **Behaviour a live user could notice:** the website's "Cancel assignment" now works (as a remove);
  a set-expiry tick no longer closes a deferred creator; a creator offer with a future start date no
  longer discounts before it; a sale now stores the offer id it used; the legacy creator detail no
  longer returns the brand's brief and budgets.
- **Open-group broadcast:** unreachable in practice — no screen creates an open-group set (the phone
  and the website set editors never send `influencer_mode`) and production has zero such sets. Left
  alone, as instructed.

## Phone
Brand app: four new screens in the Campaigns stack, the set detail extended, `DiscoverList` gains a
per-row pick state, `brandApi` gains seven methods and loses its duplicate group methods. Creator app:
the Invites / Done tabs are real, two new screens in the Collabs stack, `influencerApi` gains four
methods. All JavaScript; OTA only.

## Websites
No screen edits terms or opens the picker. `dashboard/campaigns/[id]/influencers` "Cancel assignment"
keeps calling the same route (now a remove; its toast still reads a refund of ₹0.00).

## Tests
Backend `tests/item5-invitations.test.js` (26); mobile `item5Brand.test.js` (10) and `item5Creator.test.js`
(7); two item 3 / item 4 assertions updated for the new behaviour (Add creators opens the picker; the pitch
card sits on Pitches).
