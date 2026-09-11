# item3b-social-numbers — impact

**Verdict: production-impacting.** Four migrations (175–178, the last one NULLs every creator's five
number columns until their first real run — founder Q4), a new hourly job that spends real Apify money
under a US$5/month guard, extended endpoints, two OTA bundles and three admin pages. Explicit go required.

## Database
- 175: `influencers.instagram_handle` and `creator_profiles.ig_handle` nullable + at-least-one-handle
  checks (validated; all production creators pass). 176: `creator_social_accounts` backfilled from today's
  handles (approved → `measuring`, pending → `waiting_approval`), five columns NULLed. 177: runs,
  snapshots, posts. 178: metrics, admin flags. Nothing dropped.
- After release Discover shows "—" and item 2 minimums fail for every creator until measured (expected,
  founder Q4). The backfill spreads the first runs over 3 days.

## Backend
- New: `apifyRuns.service` (async runner, header auth, cost), `socialCalc.service`,
  `socialAccounts.service` (the only writer of the five legacy columns), `socialMeasure.service`,
  `jobs/social-measure.job` (hourly :25), `social.routes` (13 endpoints), `socialCopy`.
- Changed: registration (no scrape, no n8n, at least one handle), `PATCH /influencers/me` (handles through
  the account rules), `GET /influencers/:id` (+`social`), admin verify (starts measuring), admin rescrape
  (→ Measure now), admin CSV import (no numbers). Removed: `refreshYouTubeStats`.
- Readers of the five columns (29 files) unchanged and null-safe.

## Apify spend (measured in the probe and the e2e run, free plan US$5/month)
See `06-diff/notes.md` for the real per-run costs and the monthly estimate.

## Phone apps (OTA, no native modules)
Brand: `PlatformCard`, `SocialDetailScreen`, P1 cards. Creator: two-step registration, Your numbers row +
screen, Profile info handle sheets. Formatting: always one decimal for K/M (mockup), year suffix, window label.

## Admin website (minimal)
Creator detail: Social numbers panel + Measure now (replaces Rescrape). Influencers: "Handle checks" tab
(+ flags). Analytics: one Apify cost line.

## Website side effects (open items)
- `/influencers/register` requires at least one handle and no longer measures; Instagram can be null.
- The admin CSV import no longer writes followers/engagement.
- Creator numbers on the website search come from the pipeline (null until measured).

## Rollback
Previous commit + previous OTA bundles; migrations are additive except the NULLing of numbers that were
never measurements (the CSV values are gone from the columns; the import file still exists with admin).
