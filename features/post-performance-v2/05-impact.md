# post-performance-v2 — impact (written at spec stage; spec LOCKED 25 Oct 2026; re-read after the mockup lock)

**Verdict: production-impacting when built, additive, no money path touched. Today this folder is deploy-inert:
it holds a spec and nothing under `backend/src`, `backend/migrations` or `Packages/*`.** When built: one
additive migration (210: three new tables, one CHECK widened), a new daily job that spends from the same
US$5 Apify budget as Level 1 under the same guard, one API whose path stays and whose shape changes
(brand web only reader), one route removed (`refresh-stats`, no phone caller), and lines added under
links on four phone screens and two post-stats screens. Deploy = migration → push (Render + Vercel) →
OTA brand + creator. Explicit go required.

## What is added
- **Database (migration 210):** `post_stat_runs`, `proof_stats`, `proof_stat_reads`; `social_admin_flags.kind` gains `owner_mismatch`. Nothing dropped this release; `deliverable_stats` (001:267–279) stays, unwritten, for a later housekeeping migration.
- **Server:** `services/postStats.service.js` (track · due · read · seed · stop · refresh · statsFor), `jobs/post-stats.job.js` (06:10 IST), route `POST …/content/stats/refresh` (brand `B` and creator `C` bases of item12.routes.js:20–21), the `stats` object on every proof in the content read, `social` on both post-stats reads and the set posts list, `postRuns` on `/admin/social/costs`, the new flag kind in admin flags.
- **Phone (both apps, no new screen):** the state line under `LinkBox12` / `LinkLine12` on ContentScreen, BrandContentScreen, SaleLiveScreen, BrandSaleLiveScreen; the "On social media" line on PostStatusScreen and BrandSetPostsScreen; the "On social media" block on PostStatsScreen (creator and brand modes); Update now on the content / Going live screens.
- **Website:** the Analytics tab of the campaign page rewritten to the new shape (tiles, by set, by creator, by link, one Update now); the admin analytics cost line.
- **Tests:** `backend/tests/post-performance-v2.test.js` (E1–E27), phone jest suite, two Apify fixtures from the Step-0 probe.

## What is touched, and how existing behaviour holds
| File | Change | Why existing behaviour holds |
|---|---|---|
| `contentFlow.service.js` `read` (:380–420) | each `proofs[]` entry gains `stats` | additive key; every item 12/14/15/21 check reads the keys it had |
| `contentFlow.service.js` `markPosted` (:671–690) | after the UPDATE, inside the same transaction, `postStats.track(cc.id)` | the compare-and-swap stays first; tracking rows are written only when `rowCount === 1` |
| `contentFlow.service.js` `setProof` (:623–654) | an `outside` row's link tracks at save; a replaced link closes the old row | package rows unchanged (still refused after `posted_at`) |
| `engagement.service.js` | rewritten to read `proof_stats` by campaign | path and auth unchanged (engagement.routes.js:10); the brand web page is the only reader (S17, S18) |
| `engagement.controller.js` `refreshDeliverableStats` + `deliverable.routes.js:57` | removed | no production caller can reach a live legacy deliverable (S1–S2); phone defines but never calls it (api.js:852) |
| `apify.service.js` | `scrapePostEngagement`, `normaliseEngagement`, `ENGAGEMENT_FIXTURE_PATH` removed; `scrapeProfile` stays | `scrapeProfile` is item 3b's legacy write-through input, untouched |
| `jobs/index.js:90` | `apify-engagement` unscheduled and the require removed; `post-stats` added at `'10 6 * * *'` with `tz` | other schedules unchanged |
| `socialMeasure.service.js` `monthSpend` (:27–32) | the `run_log` fallback sums both run tables | the primary source (Apify's own figure) is unchanged |
| `social.controller.js` `costs` (:132–141) | adds `postRuns` and `totalUsd` | existing keys kept; admin page reads `accountMonthUsd` first (page.js:205) |
| `shoppablePosts` stats reads (creator and brand post stats, set posts list) | add `social` | additive keys |
| Brand web `page.js:850–950`, `lib/api.js:597` | Analytics tab rewritten; `refreshStats` removed | other tabs untouched |

## Risks, and what answers each
- **Budget eaten by post reads** → the job runs behind `budgetAllows('schedule')`, after the hour's Level 1 tick, with a 50-URL batch cap and the day-curve (01-spec P5–P6; E17–E18). The admin cost line names both lanes.
- **Wrong actor input shape** (the store README vs the real run) → the Step-0 probe fixtures are the mock's answers; E7 asserts the exact input sent.
- **Numbers invented in mock mode** → the mock answers `[]` for an unknown URL → `unreadable`, never a number (apifyRuns.service.js:130).
- **Old brand web bundle against the new API** → Vercel deploys with the same push; the old page's reads of `by_influencer` on the new shape render zeros, not a crash (optional chaining at page.js:226–233).
- **Old phone bundle** → every new key is additive; an un-updated app shows the links as today.
- **Ownership flag noise** (collaborative posts carry the co-author in `owner_handle`, migration 177:58) → one flag per link while unresolved; admin resolves; `owner_unknown` for creators without a confirmed account.
- **Regression** → full backend compare against a fresh baseline (bar: 0 newly failing); item 12, 14, 15, 20, 21 suites; phone suite.

## Not touched
Money (escrow, wallets, commission, pricing), the shopper app, Level 1's pipeline and its tables, Level 3 links and clicks, Level 4 in-app engagement, Shiprocket, offers, pitches, invitations, agreements.
