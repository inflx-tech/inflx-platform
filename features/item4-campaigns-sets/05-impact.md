# item4-campaigns-sets — impact

**Verdict: production-impacting.** One migration (180), new rules on four existing endpoints, three new
endpoints, one new hourly job, one OTA bundle (brand), two website switch-offs. Explicit go required.

## Database (migration 180, additive, no backfill)
`campaigns.updated_at` (+ trigger), `campaigns.started_from_group_id`; `campaign_sets.branch_id`
(RESTRICT), `created_at`, `updated_at` (+ trigger), `expired_at`; CHECK "a Store Visit set names a branch"
(validated: production has zero visit sets); indexes on `campaign_sets(campaign_id)`, the expiry scan, and
`campaign_influencers(set_id, status)`. The nine legacy sets read as drafts that need a date.

## Backend
- New: `services/campaignState.service` (states, counts, cutoff, locks, delete rules, validation),
  `services/campaignCopy` (§7 messages), `controllers/campaignSets.controller` (A1, A5, A10),
  `jobs/set-expiry.job`.
- Changed: `POST/PATCH/DELETE /campaigns` and `/campaigns/:id/sets` (item 4 rules, exact messages),
  `POST …/duplicate` (settings only), `POST …/invite` (date/cutoff refusals; cross-set fix), the open-group
  broadcast (same fix), `setShape.model` (7 days), `brandBranches.remove` (in-use refusal),
  `collabEligibility` (set's branch city).
- **Behaviour changes a live user could notice:** a live set's Aim, date, mode and branch can no longer be
  edited (nothing was locked before); a set with invitations can no longer be deleted (it could, taking
  contracts with it); a set needs a posting date, Aim and mode to be created (the old wizard did not
  insist); the "keep at least one set" rule is gone; duplicate no longer copies creators; a published
  campaign can be renamed.
- Legacy test fixtures in 14 suites gained a posting date and a mode (27 payloads) — rule drift, no
  assertion changed. One legacy assertion changed to the new rename rule.

## Phone
Brand app only (OTA, no native module): a Campaigns stack of five screens replaces the "coming soon" tab;
`DateField` re-themed and given a confirm step; item 3's campaign placeholder strings deleted, the item 5
ones reworded; G10 "New campaign" from a group now opens the real screen. Creator app untouched.

## Websites
`app/dashboard/influencers/[id]`: the invite button and modal are switched off with a message.
`app/dashboard/settings/profile`: the branch editor is replaced by a message and the save no longer writes
`listing_data.branches`. No other website screen changes; the server rules apply to them too, and none of
them writes a set.

## Open after this item
- "Completed" is the stand-in rule; a Pay for Sale set cannot reach it until the §19 completion rule
  writes `completed` for commission-only work.
- One production brand's main branch has no city; its Store Visit sets will fail item 2's eligibility
  check until the city is set from the app.
- The website's Campaign Command Center still reads the legacy posting window for sets built on the phone.
