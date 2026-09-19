# registration-and-profile — impact

**Production-impacting. No money moves.** Explicit go required before migrate, push and OTA.

## Database — migration 188, additive
`ref_states.is_offered`, `ref_cities.is_offered` (six states, 146 cities flagged; new cities
inserted `source='seed'`; nothing deleted). `ref_languages` +20, all 30 re-sorted.
`ref_creator_niches` +`other`. `influencers` +`state_id`, `email`, `niche_other`,
`niche_other_resolved_at`, `submitted_for_review_at`. `brands` +`email`, `bank_account_no`,
`bank_ifsc`, `submitted_for_review_at`. Backfills: `influencers.state_id` from `city_id`;
`submitted_for_review_at = created_at` for every account that is pending today, so the existing
queue does not empty.

## Behaviour that changes for existing users
- **Pending creators and brands enter the app** after OTP. Every creator action route now
  answers `ACCOUNT_PENDING` (403) for a pending creator — none did before, which was invisible
  only because no pending creator could reach the app.
- **Approval refuses an incomplete profile** on both admin paths. Any account in today's queue
  that is incomplete cannot be approved until the person (or the team, via the app) fills it.
- **Registration payloads change.** Phones on the old bundle send typed `city`/`state`; the
  server resolves them for one OTA generation and refuses an unresolvable pair. `place_id` is
  ignored everywhere; `POST /places/resolve` is gone.
- **Brand-web dashboard** (out of scope, re-skinned later): its registration form still posts
  typed city/state and the Google fields — typed names resolve, the Google fields are ignored.
  Its branch editor's `place_id` no longer resolves; it must type the four parts. `GST number`
  and map pin leave the admin brand review list.
- The agreement PDF gains GSTIN, PAN and both addresses for agreements generated from now on;
  signed agreements are snapshots and do not change. This prints the brand's registered street
  on the document, which the item-7 file header said should never reach the creator before the
  visit; the locked spec §8 asks for it explicitly and wins.
- `brands.phone` is no longer read; `business_phone` leaves `GET /brands/me`.

## What does not change
Balances, escrow, ledger, contracts, invitations, sets, campaigns; the follower app and its
Google location capture; the brand's existing `requireApproved` gates; the 92 existing cities and
36 states (still valid, still shown); encryption of UPI/bank/PAN (same helper; brand bank now
encrypted the same way).

## Apps
Brand and creator OTA (JS only; `NATIVE_RUNTIME` unchanged). The Waiting screen is deleted.

## Tests re-baselined deliberately
`item2-settings-api` (10 → 30 languages, 20 → 21 niches), `item3-branches` and `item3-profile`
(Google resolution paths become "retired" assertions), `brand.test` / `influencer.test` /
`factories` (register payload carries ids).
