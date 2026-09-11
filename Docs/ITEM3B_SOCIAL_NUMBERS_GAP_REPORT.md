# Item 3b — Social Numbers (Instagram and YouTube through Apify): Phase 1 gap report

Date: 2026-09-11 · Sources: rules doc v1.12 §2A (with §5A, §8A), `INFLX_Item3b_Social_Numbers_Mockups.html` (locked 11 Sep 2026), `INFLX_Item3b_Claude_Code_Prompt.md`. Repo read at commit `01be99d` (item 3 live). Read-only: no code, migration or data was changed. One production read-only query was run for the facts in §0.

Status codes: **E** exists and matches · **P** partly exists · **M** missing · **C** exists but conflicts with the rules.

---

## 0. Two things to know before the tables

**1. (Superseded on 11 Sep evening — see §3.4.) At the time of this survey no working Apify token was in the repo.**
`backend/.env` holds a 12-character value and `backend/.env.prod-backup` a 21-character value under `APIFY_TOKEN`; both are rejected by Apify's own account endpoint (`GET /v2/users/me` → 401 "user or token not found"; real tokens are ~40 characters). My probe script started 8 runs and every one was refused at start, so **US$0.00 was spent and no fixtures exist**. Production runs with `APIFY_MOCK=true` (`.env.prod-backup:44`; `env.js:42` also defaults the switch to mock unless it is literally `false`), so **Apify has never actually measured anything in production**. Section 3 lists exactly what the probe will run the moment a valid token is available, and what I could and could not answer without it.

**2. The numbers on production today are not measurements.**
Production has 25 approved creators: 25 with an Instagram handle, 1 with a YouTube handle, 3 with an Instagram measurement timestamp (24–25 Aug), 0 with a YouTube one. All 25 have `followers_count` and `engagement_rate` set: 22 of them came from the admin CSV import (`admin.controller.js:716–764`, which writes followers and engagement straight from a spreadsheet), and the 3 "measured" ones were written at registration by the **mock** fixture (registration calls `apifyService.scrapeProfile`, which under `APIFY_MOCK` reads `mocks/apify_instagram.json` — `apify.service.js:16–24`). Three creators carry 0 followers / 0% engagement. YouTube was never measured (`youtube_subscribers` set for 0 of 25). This matters for the backfill question in §10.

Also on production: `creator_profiles` (the marketing-scraped table) has 48 rows, 0 onboarded, 3 verified, 3 linked to an influencer; `deliverable_stats` has 0 rows (the existing Apify job has never written anything).

---

## 1. Summary table

| Area | Status | One-line gap |
|---|---|---|
| Apify client | P | Two copies of a sync `run-sync-get-dataset-items` helper (120 s cap, no run id, no cost, no retry): `apify.service.js:141–189`, `youtube.service.js:197–237`. Async run + poll, run id, `usageTotalUsd`, idempotency: all missing. |
| Apify token / mode | M | No valid token in any env file; prod on mock. Blocks the probe and Phase 4 live verification. |
| Measurement triggers | C | Instagram is measured **at registration** (`influencer.controller.js:304`), before approval — the opposite of §2A. Admin approval (`creatorVerification.controller.js:118–130`) has no hook. No schedule exists (`jobs/index.js:44–98`). |
| YouTube | P | `refreshYouTubeStats` (`influencer.controller.js:126–145`) reads one video's channel totals via `streamers~youtube-scraper`; runs only at registration/rescrape; measured 0 of 25. No uploads, no long/short split. |
| Posts, snapshots, run log, flags, cost | M | No table stores posts, per-run snapshots, run logs, costs or admin flags. `influencers.scrape_data` / `youtube_scrape_data` (jsonb) hold one raw blob each. |
| Calculations | M | Nothing computes 90-day averages; `engagement_rate` is whatever the scraper or the CSV said. YouTube engagement does not exist. |
| Account states + handle ownership | M | No account table, no states, no admin check on a changed handle. Item 3 made Instagram locked and YouTube freely editable in Profile info (`ProfileInfoScreen.js:119–123`, `influencer.controller.js:531`) — a YouTube change today updates the handle silently with no re-check. |
| "At least one account" | C | Registration requires Instagram (`influencer.controller.js:281`; app `InfluencerRegisterScreen.js:48`); `influencers.instagram_handle` is `NOT NULL UNIQUE` (`001_initial_schema.sql:153`); `creator_profiles.ig_handle` is `NOT NULL UNIQUE` and the claim flow keys on it (`influencer.controller.js:170–176, 222–227`). A YouTube-only creator cannot exist today. |
| Existing readers of the five columns | E | 29 files read them (§7); all tolerate null except the item 2 eligibility numbers (they coalesce to 0, which is the right outcome) — write-through keeps them working. |
| Brand app screens S1–S4 | P | P1 exists (item 3) with the three top numbers, handle tags and "Measured by INFLX · updated {d}". Platform cards, S2, S3 and the S4 states are missing. S5 needs data only. |
| Creator app R1, R3–R6 | P | A7/A8 exist (item 3). R1 accounts step, "Your numbers" row + screen, states, handle-change sheets are missing. |
| Admin | P | Approve/reject live at `admin/influencers?tab=pending` (the marketing verifications page redirects there) and "Rescrape" on the creator detail page (`admin/influencers/[id]/page.js:99–113`). Handle checks, flags, Measure now, monthly cost: missing. |
| Jobs runner | E | `node-cron` in `jobs/index.js`, `ENABLE_CRONS=false` in tests. No job uses row locking today (only two services use `FOR UPDATE`); the scheduler needs `FOR UPDATE SKIP LOCKED`. |
| Tests | E | Baseline at this tree: **229 failed / 869 passed / 1098** (full run 2026-09-11 after item 3; only `lock.json` changed since). |

---

## 2. Requirement table

### §2 of the prompt — current state to verify

| # | Claim | Status | Evidence |
|---|---|---|---|
| 2.1 | Instagram followers/engagement written only at registration and admin rescrape | E (plus one more writer) | Registration `influencer.controller.js:304–330`; rescrape `:1301–1318`; **also** the admin CSV import `admin.controller.js:716–764` (`followers_count`, `engagement_rate` from the sheet) — a third writer the prompt did not list. |
| 2.2 | YouTube subscribers from `refreshYouTubeStats`, early return when not configured; 0 of 25 measured | E | `influencer.controller.js:126–145` (`if (!yt.configured \|\| !yt.found) return yt;`); `youtube.service.js:121–127` returns `configured:false` without a token; prod: `youtube_scrape_last_run` set for 0/25. |
| 2.3 | No scheduled refresh; an Apify job writes `deliverable_stats` | E | `jobs/index.js:44–98` schedules 14 jobs, none touches influencers' numbers; `jobs/apify-engagement.job.js:6–60` scrapes live deliverable URLs daily at 06:00 (`index.js:66`) via `apify~instagram-scraper` (`apify.service.js:46–90`), no locking, sequential, errors logged per row. Client: `fetch` to `https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token=…&timeout=120` with a 180 s abort (`apify.service.js:141–189`); env `APIFY_TOKEN`, `APIFY_MOCK` (default mock), `APIFY_YOUTUBE_ACTOR` default `streamers~youtube-scraper` (`config/env.js:42–53`). Sync mode only; no run id, no cost, no webhook, no polling. |
| 2.4 | Measurement timestamps on 3 of 25 | E | Prod query 2026-09-11: `scrape_last_run` on 3 (24–25 Aug), `youtube_scrape_last_run` on 0. |
| 2.5 | Registration handles + where it measures | E | One screen (`screens/auth/InfluencerRegisterScreen.js`, Phone → OTP → InfluencerRegister → Waiting per `AuthNavigator.js:15–20`): name, city, Instagram (required), YouTube (optional). Server `influencer.controller.js:273–350`: scrapes Instagram **synchronously before the INSERT** (`:304`), inserts `scrape_last_run = now()`, then `refreshYouTubeStats` (`:344`). It also fires the n8n "A2 profile scraper" webhook (`:255`, `marketingAutomation.service.js:41–80`) — a second, separate scrape pipeline into `creator_profiles`, skipped when `N8N_BASE_URL` is unset (it is unset in `.env.prod-backup`). |
| 2.6 | Admin approval + post-approval hook | E | `POST /admin/creator-verifications/:id/verify` (`admin.routes.js:132`) → `creatorVerification.controller.js:67–143` sets `creator_profiles.verification_status='verified'`, `influencers.approved_at`, `users.status='approved'` inside one transaction. **No hook after approval.** Reinstating a suspended creator goes through `admin.controller.js:199–…` (`updateInfluencerStatus`, approved only from suspended). |
| 2.7 | Handle normalisation | P | Registration: `normaliseHandle` strips `@`, trims, lower-cases — **no format check, no URL stripping** (`influencer.controller.js:110–114`). YouTube on edit: `normaliseYoutube` strips URLs/`@`, lower-cases, keeps the first path segment (`:30–37`); `youtube.service.parseChannelRef` (`:33–58`) understands `channel/UC…`, `user/`, `c/` and handles. Instagram is not editable after registration. Nothing validates the 1–30 `[A-Za-z0-9._]` rule. |

### §3.1 Accounts and states

| ID | Requirement | Status | Evidence / proposed change | Risk |
|---|---|---|---|---|
| 3.1a | One account row per creator per platform with the 9 states | M | No table. Propose `creator_social_accounts` (§4). | Low |
| 3.1b | Approved → `measuring` + full run per handle | M | Hook in `creatorVerification.verify` after the `users.status='approved'` write (`:128`), and in `admin.updateInfluencerStatus` when a suspended creator is re-approved. | Low |
| 3.1c | Handle change/add after approval → clear numbers → `waiting_check` → admin | M / C | Today a YouTube change saves silently (`influencer.controller.js:531`); Instagram is locked in the app (`ProfileInfoScreen.js:119`) but the API would accept it only via register. Route both through the new account service. | Medium: item 3's "Instagram locked" copy becomes editable |
| 3.1d | Remove a handle only if the other stays | M | Needs `instagram_handle` nullable (§4, migration 175). | **High** (schema + claim flow, §10 Q3) |
| 3.1e | Run results → states; failure retry next day; flag after 3 | M | Run log + `failure_count` on the account. | Low |
| 3.1f | Suspended → pause; re-approved → resume; rejected → no runs | M | Scheduler joins `users.status='approved'`. | Low |

### §3.2 When runs happen

| ID | Requirement | Status | Proposed change | Risk |
|---|---|---|---|---|
| 3.2a | Triggers: approval, handle confirm, profile every 7 d, posts every 15 d, Check again (24 h), Measure now, retry next day | M | `social-measure.job` hourly; `profile_due_at` / `posts_due_at` on the account; `last_check_again_at` for the 24 h rule. | Low |
| 3.2b | Row locking so no double runs | M | `SELECT … FOR UPDATE SKIP LOCKED LIMIT $batch` inside a transaction that marks `run_started_at`; no job does this today (`grep FOR UPDATE src/jobs` → none). | Low |
| 3.2c | Batch size, concurrency (3), timeouts configurable | M | `SOCIAL_BATCH_SIZE`, `SOCIAL_CONCURRENCY`, `SOCIAL_RUN_TIMEOUT_SECS` in `config/env.js`. | Low |
| 3.2d | Budget guard `APIFY_MONTHLY_BUDGET_USD` | M | Sum of `usage_usd` in the run log for the calendar month; scheduled runs skip, approval/confirm/Measure-now still go; flag once per month. | Low |

### §3.3 Apify runs

| ID | Requirement | Status | Evidence / change | Risk |
|---|---|---|---|---|
| 3.3a | Reuse the existing integration | P | Same token and base URL, but the sync helper cannot return the run id or cost, and 120 s is too short for a 90-day post run. Propose a third, shared `apifyRuns.service.js`: `POST /acts/{actor}/runs` → poll `GET /actor-runs/{id}` → `GET /datasets/{id}/items`; returns `{runId, status, usageTotalUsd, runTimeSecs, items}`. Leave the two existing helpers alone (deliverable stats still use them). | Low |
| 3.3b | Actors: `apify/instagram-profile-scraper`, `apify/instagram-post-scraper`, `streamers/youtube-scraper` | P | Code uses `apify~instagram-scraper` for profiles (`apify.service.js:34`) and `streamers~youtube-scraper` (`env.js:53`). Actor choice and input names must be **confirmed by the probe** (§3). | Medium until probed |
| 3.3c | Long video vs short by tab; live streams out | M | Two tab-restricted runs (`maxResults`/`maxResultsShorts`/`maxResultStreams` are the input names the code already uses at `youtube.service.js:135–140`); tab recorded per upload; fallback ≤180 s. | Medium until probed |
| 3.3d | Store per run: account, type, actor, run id, times, result, error, cost, items | M | `creator_social_runs` (§4). | Low |
| 3.3e | Webhook secret / idempotency | M | Polling (no webhook) keeps it simple and matches the existing pattern; idempotency by unique `(apify_run_id)` on the run log. | Low |
| 3.3f | Handle normalisation rules | P | See 2.7; add the Instagram regex and the YouTube canonical URL + handle + channel id fields. `influencers.youtube_handle` is `varchar(60)` — too short for a canonical channel URL; store the URL in the new account table, keep `youtube_handle` as the handle. | Low |

### §3.4 Storage

| ID | Requirement | Status | Note |
|---|---|---|---|
| 3.4a | Account | M | §4 |
| 3.4b | Profile snapshot per run | M | §4. Today one raw blob per platform (`scrape_data`, `youtube_scrape_data`). |
| 3.4c | Post per platform post id | M | §4. No post storage exists for creators' own accounts (`creator_posts` is item 13's shoppable posts, unrelated). |
| 3.4d | Metrics per posts run + current | M | §4 |
| 3.4e | Run log, admin flags | M | §4 |
| 3.4f | Old handle's posts never reused | M | Posts key on `account_id`; a handle change creates a **new** account row (old row kept as `replaced`). |

### §3.5 Window and ceiling · §3.6 Calculations

| ID | Requirement | Status | Note |
|---|---|---|---|
| 3.5 | 90-day window, 500 ceiling, flag | M | Pure functions in `socialCalc.service.js`, no DB, unit-tested on fixtures. |
| 3.6 IG | Posts, per week, mix, last post, avg likes (hidden out), avg comments, avg reel views, engagement on latest followers | M | Nothing computes averages today. The `engagement_rate` column is the scraper's/CSV's number, definition unknown. |
| 3.6 YT | Long/short split, per-type averages, engagement on views, totals | M | — |
| 3.6 fmt | 48.2K / 2.3M / 612 / 4.2% / — / 9 Sep / window label | E (mobile) | Item 3's `copy3.js` `fmtCompact` (612 → "612", 48200 → "48.2K", 1.2M), `fmtPct`, `shortDate`; "—" for null already used by `StatTriple`. Year suffix for non-current years is missing (small add). |

### §3.7 Existing readers — every reader and writer of the five columns

Writers today (all must stop or be rerouted): registration `influencer.controller.js:314–330` and `:344`; rescrape `:1301–1318` (+ YouTube `:1329`); admin CSV import `admin.controller.js:740–764`. Nothing else writes them.

Readers (file:line; all keep working with write-through; null handling noted):

| Reader | Lines | Null-safe? |
|---|---|---|
| Item 3 Discover CTE, filters, sorts, card | `discovery.service.js:52–53, 127–131, 147–149, 155–156, 200–202` | Yes — filters use `COALESCE(…,0)`, sort `NULLS LAST`, card returns null → "—" |
| Item 3 Find-brands "me" facts | `discovery.service.js:222–223, 259` | Yes (coalesce to 0 → fails minimums, as required) |
| Item 2 eligibility facts | `collabEligibility.service.js:182–197, 312` | Yes (`Number(x \|\| 0)`) |
| Item 3 groups members | `influencerGroup.controller.js:219–220` | Yes |
| Website creator search view | `migrations/146…sql` `v_searchable_creators` (`i.followers_count`, `i.engagement_rate` as both ERs, `i.scrape_last_run AS last_calculated_at`) | Yes |
| Creator profile for brands (`measured_at`) | `influencer.controller.js:42, 912–922, 940` | Yes |
| Campaign creator lists / filters | `campaign.controller.js:246, 312, 2658, 2678–2684, 2751–2756` | Yes (`NULLS LAST`; `>=` on null excludes) |
| Brand inbox, contracts, saved, follower discovery, brand offers adapter | `brandInbox.controller.js:220–221`, `contract.controller.js:1242`, `saved.controller.js:70,128`, `follower.controller.js:834–885`, `follower.service.js:1002,1053`, `brandOffers.adapter.js:377`, `discover.service.js:182–189` | Yes (display only / `NULLS LAST`) |
| Engagement service + job (deliverable stats) | `engagement.service.js:32–146`, `jobs/apify-engagement.job.js:11–33`, `engagement.controller.js:40–99` | Yes (`followers > 0` guards) |
| Admin lists/detail, analytics | `admin.controller.js:81, 1479, 1593–1602, 1677`, `creatorAnalytics.controller.js:80, 159–179` (the latter reads `creator_profiles`) | Yes |
| Website creator detail page | `Packages/brand-web/app/dashboard/influencers/[id]/page.js` (reads `engagement_rate`, `view_based_er`) | Yes (shows 0%) |

Constraints: none of the five columns is `NOT NULL` (`001_initial_schema.sql:156–157`, YouTube columns migration adds nullable bigints). **Nulling them is safe.** Note: `is_inflx_verified`/`is_verified` on the website search come from `users.status`, not from these columns — unaffected.

### §4 API · §5 Screens · §6 Messages

| ID | Requirement | Status | Note |
|---|---|---|---|
| A1 | `social.instagram` / `social.youtube` on `GET /influencers/:id` | M | Extend the item 3 response (`influencer.controller.js:964–1007`), superset. |
| A2 | Platform detail for a brand | M | New `GET /influencers/:id/social/:platform`. |
| A3 | Your numbers (creator) | M | New `GET /influencers/me/social` (+ `/:platform`). |
| A4 | Check again | M | New `POST /influencers/me/social/:platform/check-again`, 429 copy. |
| A5 | Handle change/add/remove | P | Goes through `PATCH /influencers/me` today for YouTube only; extend to both handles with the state rules. |
| A6 | Registration: at least one, format, queue nothing | C | Requires Instagram; scrapes synchronously. |
| A7 | Admin: handle checks, flags, Measure now, costs | P | Rescrape exists (`POST /influencers/:id/rescrape`, `influencer.routes.js`) → becomes "Measure now". Rest missing. |
| A8 | Webhook/internal | — | Not needed with polling. |
| S1–S4 | Platform cards, IG/YT details, states | P/M | P1 exists (`BrandCreatorProfileScreen.js`): top three numbers + `measured-line` + `HandleTag`s. Cards replace the handle tags; S2/S3 new screens; S4 states new. |
| S5 | Discover card unchanged | E | `DiscoverList.js` `CreatorCard` + `StatTriple` already show "—" for null. |
| R1 | Registration accounts step | M/C | Single-screen registration; IG required; no format errors; no stepper. R1 fits as a second step of `InfluencerRegisterScreen` (fields exist, validation and copy don't). |
| R3 | "Your numbers" row + chip | M | `ProfileScreen.js` (item 3 row list) — insert between `row-profile-info` and `row-niche`; `ProfileRow` already supports a `right` chip. |
| R4/R5 | Your numbers screen + states | M | New `YourNumbersScreen.js`; reuse `Skeleton`, `LoadErrorList`, `Banner`, `StatTriple`, `copy3` formatters. |
| R6 | Handle change sheets | M | `ProfileInfoScreen.js` save → `ConfirmSheet` (item 2 `sheets.js`). Instagram field must become editable (item 3 locked it: `ProfileInfoScreen.js:119`). |
| §5.3 | Loading / couldn't load | E | Shared components from items 2–3. |
| §6 | Messages | M | None of the six exist on the server; add to a `socialCopy` module mirrored in `copy3.js`. |
| Theme | Platform card, green hero tile, blue/red/grey state boxes, spinner | P | `settingsTokens.state` has the exact colours (`waiting` blue, `declined` red, `ended` grey, `active` green); no card/tile components yet. Fonts and tokens in place. |

---

## 3. Apify probe

### 3.1 Result: **blocked — no valid token**

| Planned run (all public accounts) | Actor | Purpose | Outcome |
|---|---|---|---|
| `ig-profile`: natgeo, mkbhd, `thisusernamedoesnotexist_xyz123` | `apify~instagram-profile-scraper` | field names; not-found shape | 401 at start |
| `ig-posts-mkbhd`: 40 posts, `onlyPostsNewerThan` = 90 days | `apify~instagram-post-scraper` | type/productType, likes −1, views field, window | 401 |
| `ig-posts-natgeo`: 15 posts, newer than 7 days | same | ceiling + newerThan behaviour | 401 |
| `yt-videos-mkbhd` (Videos tab only, 15) | `streamers~youtube-scraper` | tab marking, fields, `oldestPostDate` | 401 |
| `yt-shorts-mkbhd` (Shorts tab only, 15) | same | shorts fields | 401 |
| `yt-streams-ltt` (Streams tab, 3) | same | how streams appear | 401 |
| `yt-notfound` | same | not-found shape | 401 |
| `yt-channel-1` (1 result) | same | channel totals source | 401 |

Runs attempted: 8 (of 12 allowed). **Cost: US$0.00.** Fixtures: none. The script (`apify-probe.js`, budget-guarded at 12 runs / US$3, async run + poll, records `usageTotalUsd` and `runTimeSecs` per run, saves trimmed items) is ready to rerun the moment a token is set: `APIFY_TOKEN=<token> node scratchpad/apify-probe.js`.

Not covered even with a token unless you supply accounts: a **private** Instagram account and an account that **hides likes** (I will not guess at real people's accounts). Please provide two test handles.

### 3.2 Answers to §7.2 — what can be said without the probe (each marked)

| Question | Answer | Basis |
|---|---|---|
| Instagram profile field names | Existing code already reads `followersCount`, `followsCount`, `postsCount`, `verified`, `private`, `isBusinessAccount`, `businessCategoryName` from `apify~instagram-scraper` output (`apify.service.js:101–113`, fixture `mocks/apify_instagram.json`). The profile-scraper actor documents the same names. | Code + docs — **unverified** |
| Not found / private shape | Documented as an item with `error: "not_found"` / `private: true`; sometimes an empty dataset with a failed run. | Docs — **unverified**; must probe |
| Post type / reel | `type` ∈ Image / Video / Sidecar; `productType` "clips" for reels (`feed` for video). | Docs — **unverified** |
| Views field | `videoPlayCount` (plays) vs `videoViewCount`; the Instagram app shows plays for reels. | Docs — **unverified**; probe decides |
| Hidden likes | `likesCount: -1`. | Docs — **unverified** |
| `onlyPostsNewerThan` | Supported by `instagram-post-scraper` (ISO date or "90 days"). | Docs — **unverified** |
| YouTube tab marking | `streamers~youtube-scraper` items carry `type` ("video"/"short"/"stream") in recent builds; the code's `youtube.service.normalise` already tolerates several shapes (`:160–188`). Whether one run reliably labels every item is exactly what the probe must show; the two-run plan is the safe default. | Docs — **unverified** |
| Streams | Excluded by `maxResultStreams: 0` (input names already used at `youtube.service.js:135–140`). | Code — input names verified, behaviour not |
| YT hidden likes / disabled comments | `likes: null` / `commentsCount: null` expected. | **Unverified** |
| Channel totals | Attached to each video item (`numberOfSubscribers`, `channelTotalViews`, `channelTotalVideos`, or nested under `aboutChannelInfo`) — the code already reads both spellings (`youtube.service.js:160–188`). | Code — verified on the fixture shape only |
| `oldestPostDate` on channel URLs | Documented. | **Unverified** |
| `@handle` → channel id | The actor resolves handle URLs; channel id comes back on items (`channelId`). | **Unverified** |
| Run duration and cost | Unknown until probed. | — |

### 3.3 Cost estimate (to be replaced by measured numbers)

Published pay-per-result rates (September 2026, to confirm): Instagram profile/post scrapers about US$2.3 per 1,000 results; `streamers/youtube-scraper` about US$0.5 per 1,000 results plus compute. Per creator per month on this schedule: Instagram ≈ 4 profile results + 2 × ~20 posts ≈ 44 results ≈ **US$0.10**; YouTube ≈ 4 channel reads + 2 × (videos + shorts, ~20) ≈ **US$0.03–0.08** with compute. Rough total **US$0.15–0.25 per creator per month** → today's 25 creators ≈ **US$4–6 / month**; 1,000 creators ≈ **US$150–250 / month**. Treat as an order of magnitude only.


### 3.4 Real probe results (11 Sep 2026, run with the founder's regenerated token — Step 0 of the approval)

Token check: **valid**, plan **FREE** (US$5 of usage a month), US$0.11 already used this month.
Past runs on the account (10, all `apify/instagram-scraper`, all SUCCEEDED, US$0.13 in total): four at 06:00 UTC on 29 Jul, 31 Jul, 5 Aug and 6 Aug — the **deliverables job** (`cron.schedule('0 6 * * *', apifyEngagementJob.run)` has no timezone, so it fires at 06:00 UTC), which only calls Apify when live deliverables exist; three via the API on 25–26 Aug — the **registration scrape** of the three creators whose `scrape_last_run` is 24–25 Aug (US$0.0027 each); three on 7 Sep started from the **Apify web console** by a person (US$0.11 — the spend the founder saw). Nothing from n8n (`N8N_BASE_URL` is unset). Correction to §0: production is not on mock; the local `.env` and the stale backup were.

| Run | Actor | Items | Cost | Seconds | What it proved |
|---|---|---|---|---|---|
| ig-profile (_akshayareddyyy + a non-existent name) | apify~instagram-profile-scraper | 2 | US$0.0026 | 21 | `followersCount 192011, followsCount 327, postsCount 238, verified true, private false, isBusinessAccount false, businessCategoryName "Digital creator"`; not found = an item `{ error: "not_found", errorDescription: "Post does not exist" }` |
| ig-posts (100 cap, onlyPostsNewerThan 90 d) | apify~instagram-post-scraper | 100 | US$0.2700 | 74 | `type` Sidecar / Image / Video with `productType` carousel_container / feed / clips; 77 reels, 21 carousels, 2 photos; **0 posts older than 90 days** (the filter works); hidden likes = `likesCount: -1` (2 posts); comments disabled = `isCommentsDisabled: true` with count 0 (2); reels carry both `videoPlayCount` (plays, the app's "views") and `videoViewCount`; 8 pinned; **11 different `ownerUsername` values** — collaborative posts on her grid |
| yt-videos (Videos tab, 50 cap, oldestPostDate 90 d) | streamers~youtube-scraper | 3 | US$0.0106 | 48 | items `type: "video"`, `fromYTUrl …/videos`, `duration "00:21:14"`, `viewCount`, `likes`, `commentsCount`, `commentsTurnedOff`; channel totals on every item: `numberOfSubscribers 52000, channelTotalVideos 7, channelTotalViews 3672726, channelId UCLbs1qmAgK6p6_jIgj0gSlg` |
| yt-shorts (Shorts tab) | same | 4 | US$0.0000 | 31 | items `type: "shorts"`, `fromYTUrl …/shorts` |
| yt-streams (Streams tab) | same | 1 | US$0.0040 | 7 | this channel has none: `{ error: "CHANNEL_HAS_NO_LIVE_VIDEOS" }` |
| yt-notfound | same | 1 | US$0.0040 | 14 | `{ error: "CHANNEL_DOES_NOT_EXIST" }` |
| yt-channel-1 (1 result) | same | 1 | US$0.0040 | 20 | the cheap channel-totals read |
| yt-streams-ltt (a channel that streams, 2) | same | 2 | US$0.0080 | 59 | streams are `type: "stream"` from `…/streams` — excluded by `maxResultStreams: 0` and dropped by type |
| yt-oldest-ltt (Videos tab, oldestPostDate 10 d, 6) | same | 6 | US$0.0000 | 25 | all six dates on/after the cutoff — `oldestPostDate` works on a channel URL |

**Total: 9 runs, US$0.30** (cap was 12 runs / US$2). Fixtures saved under `backend/tests/fixtures/apify/` (trimmed: no tokens, run ids, image URLs or captions) plus two hand-made ones for the private account and the all-hidden-likes case the founder said to cover with fixtures.

**Decisions taken from the probe (design confirmed, no rule changed):** reels' views = `videoPlayCount` (plays, what the app shows) with `videoViewCount` as the fallback; comments disabled → null (left out of the average); collaborative posts that appear on her grid count as her posts (they are published on her profile; the co-author is stored in `owner_handle` for later); YouTube kind by tab, `type` when the tab is unknown, duration only as the last fallback; two tab runs per posts run, as approved.

**Real cost per run type:** Instagram profile ≈ US$0.0013 per account; Instagram posts ≈ US$0.0027 per post (this creator: ~105 posts in 90 days → US$0.28 per posts run; a typical creator with 20–40 posts → US$0.05–0.11); YouTube ≈ US$0.004 per run start plus a fraction of a cent per item. **One full run for this creator ≈ US$0.30** (IG profile + IG posts + YT videos + YT shorts). **Monthly on our schedule** (profile 4.3×/month, posts 2×/month): this creator ≈ US$0.60; a typical creator ≈ US$0.15–0.25. **25 creators ≈ US$4–6 a month** — right at the free plan's US$5 (the deliverables job counts too); **1,000 creators ≈ US$150–250 a month**. The budget guard will trip on the free plan once the backfill runs; upgrading is the founder's call.

---

## 4. Proposed migrations (additive; next free number is **175**)

| # | Migration | Contents | Dry-run checks |
|---|---|---|---|
| 175 | `item3b_handles_nullable` | `ALTER TABLE influencers ALTER COLUMN instagram_handle DROP NOT NULL`; keep the unique index; `CHECK (instagram_handle IS NOT NULL OR youtube_handle IS NOT NULL)` as `NOT VALID` then validated (all 25 have Instagram); widen nothing else (`youtube_handle varchar(60)` keeps the bare handle). | 0 rows violate the check; unique index intact; `v_searchable_creators` still valid. |
| 176 | `item3b_social_accounts` | `creator_social_accounts(id, influencer_id, platform ∈ instagram\|youtube, handle_raw, handle_norm, platform_account_id, channel_url, state, ownership ∈ pending\|confirmed\|rejected, ownership_by, ownership_at, last_profile_at, last_posts_at, profile_due_at, posts_due_at, failure_count, last_error, last_check_again_at, replaced_at, created_at, updated_at)`; one **current** row per (influencer, platform) via partial unique `WHERE replaced_at IS NULL`. Backfill: one row per existing handle of every creator; state per §10 Q4. | 26 rows (25 IG + 1 YT); one current row per creator per platform. |
| 177 | `item3b_social_runs_snapshots_posts` | `creator_social_runs(id, account_id, run_type ∈ full\|profile\|posts, trigger, actor, apify_run_id UNIQUE, started_at, finished_at, result, error, usage_usd numeric(10,4), items_received, ceiling_hit)`; `creator_social_profile_snapshots(id, account_id, run_id, measured_at, followers, following, total_posts, verified, account_type, subscribers, total_videos, total_channel_views)`; `creator_social_posts(id, account_id, platform_post_id, kind ∈ reel\|photo\|carousel\|long\|short, tab_source ∈ tab\|duration_fallback, published_at, duration_secs, likes, comments, views, url, first_seen_run, last_seen_run, UNIQUE(account_id, platform_post_id))`. Indexes on `(account_id, published_at DESC)`. | Tables empty after migration. |
| 178 | `item3b_social_metrics_flags` | `creator_social_metrics(id, account_id, run_id, window_start, window_end, …every §3.6 number…, hidden_likes_count, computed_at)` + `is_current` partial unique per account; `admin_flags(id, kind ∈ failing_3\|budget\|ceiling, account_id, detail jsonb, created_at, resolved_at)`. | Empty. |
| — | Backfill job (not a migration) | Queues a full run for every approved creator with a handle, spread over N days (§10 Q5). | Runner prints the queue. |

All additive; nothing dropped; `scrape_data` / `youtube_scrape_data` left in place (unused by the new pipeline).

---

## 5. Proposed services and jobs

| Piece | File | Responsibility |
|---|---|---|
| Apify runner | `services/apifyRuns.service.js` | `startRun(actor, input)` → poll → `{runId, status, usageTotalUsd, runTimeSecs, items}`; timeout from env; `APIFY_MOCK` reads fixtures under `tests/fixtures/apify/`; never throws on not-found/private — returns a classified result. |
| Account state machine | `services/socialAccounts.service.js` | `ensureAccounts(influencerId)`, `onApproved`, `onHandleChanged/Added/Removed`, `confirmOwnership`, `rejectOwnership`, `applyRunResult`, `checkAgain` (24 h rule), state → brand label mapping. The only writer of the five legacy columns (`writeThrough(influencerId)`, `clearPlatform(influencerId, platform)`). |
| Calculators | `services/socialCalc.service.js` | Pure: `instagramMetrics(posts, followers, window)`, `youtubeMetrics(uploads, window)`, `classifyUpload(item, tab)`, formatting lives in the apps. |
| Run processor | `services/socialMeasure.service.js` | Executes one run: picks actor + input per run type, stores run/snapshot/posts, recalculates metrics, applies state, writes through. Idempotent on `apify_run_id`. |
| Scheduler | `jobs/social-measure.job.js` hourly | `SELECT … FROM creator_social_accounts a JOIN influencers i JOIN users u WHERE u.status='approved' AND a.state IN (measuring, ok, failing) AND (profile_due_at <= now() OR posts_due_at <= now() OR retry_at <= now()) FOR UPDATE SKIP LOCKED LIMIT $batch`; runs `SOCIAL_CONCURRENCY` at a time; budget guard first; flags after 3 failures. |
| Budget guard | inside the scheduler | `SUM(usage_usd) this month >= APIFY_MONTHLY_BUDGET_USD` → skip scheduled, flag once. |
| Backfill | `scripts/run-social-backfill.js --dry\|--apply` | Spreads `profile_due_at`/`posts_due_at` over N days from approval date order. |
| Removal | `influencer.controller.js` register (`:304–344`), rescrape (`:1301–1340`), admin CSV import (`admin.controller.js:740–764`) | Register: save handles only, create accounts in `waiting_approval`. Rescrape: becomes "Measure now" through the pipeline. CSV import: stop writing `followers_count`/`engagement_rate` (question Q9). |

---

## 6. Proposed endpoints

| ID | Endpoint | Shape | Errors | Callers affected |
|---|---|---|---|---|
| A1 | `GET /influencers/:id` (extend) | `+ social: { instagram: {state: ok\|updating\|unavailable\|stale, handle, verified, accountType, engagement, avgReelViews, posts90d, followers, updatedAt} \| null, youtube: {state, handle, channelName, avgLongViews, avgShortsViews, uploads90d, subscribers, updatedAt} \| null }` | — | Brand app P1 (item 3), website creator detail (ignores new key) |
| A2 | `GET /influencers/:id/social/:platform` (brand/admin) | profile block, window `{start,end}`, per-type numbers, `hiddenLikesCount`, `lastPostAt`, `profileMeasuredAt`, `postsMeasuredAt`, `openUrl`, brand `state` | 404 when not approved / not added / unavailable | none (new) |
| A3 | `GET /influencers/me/social` · `GET /influencers/me/social/:platform` | both accounts with internal `state`, card numbers, `lastProfileAt`, `lastPostsAt`, `postsDueAt`, `checkAgainAvailableAt`, `chip ∈ fix_instagram\|fix_youtube\|fix_accounts\|waiting\|measuring\|null` | — | none (new) |
| A4 | `POST /influencers/me/social/:platform/check-again` | `{ account }` | 409 `NOT_ALLOWED` outside private/failing; 429 `RATE_LIMITED` "You can check again once a day." | none |
| A5 | `PATCH /influencers/me` (extend) | `instagram_handle`, `youtube_handle` (null = remove) → `{ influencer, social: {changed: [{platform, action: add\|change\|remove}]} }` | 422 `INSTAGRAM_INVALID` / `YOUTUBE_INVALID` / `LAST_ACCOUNT` with the §6 messages | Creator app A8, website (none edits handles) |
| A6 | `POST /influencers/register` (change) | Instagram optional, at least one; format errors; **no scrape** | 422 with §6 messages | Creator app R1; tests that register YouTube-only creators |
| A7 | `GET /admin/social/handle-checks` · `POST …/:accountId/confirm` · `POST …/:accountId/reject` · `GET /admin/social/flags` · `POST /admin/social/accounts/:id/measure-now` · `GET /admin/social/costs?month=` · `GET /admin/influencers/:id/social` | plain lists | capability `marketing` like the verification routes | Admin website (new panels) |
| A8 | — | polling; no webhook | — | — |

Privacy: A1/A2 return only the four brand labels; never `waiting_check`, error text, ownership decisions, costs; pending creators stay 404 for brands (item 3 rule).

---

## 7. Existing-column plan (§3.7)

- After every **successful** profile or posts run: `followers_count`, `engagement_rate`, `scrape_last_run` (Instagram) and `youtube_subscribers`, `youtube_scrape_last_run` (YouTube) are rewritten from the current metrics/snapshot by `socialAccounts.writeThrough`.
- On change / add / remove / `not_found` / `private` / `rejected`: that platform's columns set to **null**. Verified null-safe across all readers (§2, §3.7 table). Discover then shows "—" and the followers/engagement filters exclude the creator (`COALESCE(…,0)`), item 2 minimums fail (0 < minimum), the website search view shows null.
- Writers removed/rerouted: registration measurement, admin rescrape, admin CSV import numbers (Q9). After Phase 2 the pipeline is the only writer (a test asserts this by grepping the source for `SET followers_count`).
- `measured_at` (item 3) keeps its definition: greatest of the two profile times.

---

## 8. Frontend plan

**Brand app** (`Packages/Mobile`, OTA, no new native modules)
- `BrandCreatorProfileScreen.js` (P1 → S1): replace `HandleTag`s with `PlatformCard` (new `components/social/PlatformCard.js`: header, three tiles, chevron; state variants updating / unavailable / stale / no-posts) fed by `social`.
- New `InstagramDetailScreen.js` and `YouTubeDetailScreen.js` (S2/S3) in the Creators stack; shared `MetricTile`, `MixBar`, `FormulaBox`, section headers; both reused by the creator app with the R4 info box on top.
- S5: no change.

**Creator app**
- `InfluencerRegisterScreen.js` (R1): split into step 1 (name, city) and step 2 "Your social accounts" with the stepper, both fields, on-device format checks and the exact errors; Instagram no longer required; still lands on `Waiting`.
- `ProfileScreen.js` (R3): new `ProfileRow` "Your numbers" with subtitle and chip (red `Fix …`, blue `Waiting`/`Measuring`) from A3.
- New `YourNumbersScreen.js` (R4/R5): info box, two `PlatformCard`s in creator mode with per-state boxes and actions (Fix username → `ProfileInfo` with `focus` param; Check again → A4; Add → `ProfileInfo`).
- `ProfileInfoScreen.js` (R6): Instagram editable; on save with a handle change/add/remove show the `ConfirmSheet` copy; "Keep at least one account." error.
- Formatting: `copy3.js` gains the year suffix and the window label helper.
- Tests: render tests for every S4/R5 state and the chip priority.

**Admin website** (`Packages/brand-web/app/admin`, smallest fit)
- `influencers/[id]/page.js`: a "Social numbers" panel (state per platform, last runs, **Measure now** replacing the Rescrape button, confirm/reject when a handle check is pending).
- `influencers/page.js`: a new tab **"Handle checks"** next to Pending (the verification queue already lives there via the redirect at `marketing/verifications/page.js:11`), and a small **Flags** list.
- `analytics` or `billing`: one line "Apify this month: US$x (Instagram y / YouTube z)".

---

## 9. Test baseline and tests to add

**Baseline (this tree, 2026-09-11):** backend **229 failed / 869 passed / 1098** (`--runInBand`, private PG 18); mobile item 2 + 3 suites 58 pass. Item 3b must end with no new failures.

Tests to add (backend): `item3b-calculators` (fixtures + hand cases: hidden likes some/all, 0 posts, no reels, long/short split, stream excluded, duration fallback, disabled comments, views 0, rounding); `item3b-state-machine` (every §3.1 transition incl. suspended/re-approved/rejected); `item3b-scheduler` (due dates after full/profile/posts, SKIP LOCKED no double run, retry next day, flag after 3, budget guard); `item3b-runs` (idempotent re-processing, cost logged, mock runner); `item3b-api` (A1 mapping never leaks, A4 409/429, A5 change/add/remove, A6 queues nothing, A7 admin); `item3b-write-through` (columns after success and null on the six events; item 2 eligibility and item 3 Discover afterwards). Mobile: `item3bBrand.test.js` (S1 cards, S4 states, S2/S3 tiles), `item3bCreator.test.js` (R1 errors, R3 chip priority, R5 states, R6 sheets). Existing tests that will need the new rules: `influencer.test.js` registration (Instagram optional), `item3-discover` (already null-safe), the admin rescrape test (becomes Measure now).

---

## 10. Questions for the founder (each with a recommendation)

1. **Apify token (blocking).** Neither env file holds a real token and production runs on mock. Please put a working `APIFY_TOKEN` in `backend/.env` (for the probe) and confirm Render's value; I will then run the 8 probe runs (≤ US$3) and complete §3 before Phase 2. *Recommendation:* create a dedicated Apify account/token for INFLX with a monthly spending limit set in Apify itself, in addition to our budget guard.
2. **Test accounts for the probe.** Please supply a private Instagram account and one that hides likes (yours or a team member's). *Recommendation:* two throwaway accounts you control.
3. **YouTube-only creators.** Rules §2A allows "Instagram and/or YouTube", but `influencers.instagram_handle` is `NOT NULL UNIQUE`, and the website's creator-claim flow (`creator_profiles.ig_handle NOT NULL`) keys on it. Making Instagram optional means: migration 175, the claim step skipped for YouTube-only sign-ups, and the website search view unchanged. *Recommendation:* yes, allow YouTube-only; keep the claim step Instagram-only for now.
4. **Backfill vs "measuring shows no numbers".** §3.8 says existing numbers stay until the first new run; §3.1 says `measuring` shows nothing. Today's numbers are CSV-imported or mock values (see §0), not measurements. *Recommendation:* start every existing account as `measuring` and **hide** the old numbers (brands see "Numbers are being updated" for a few days); write-through happens only after a real run. Cleaner than showing spreadsheet numbers as "Measured by INFLX".
5. **Backfill spread N.** *Recommendation:* 3 days for today's 25 creators (about 9 per day); make N an env value for later.
6. **Budget guard.** *Recommendation:* `APIFY_MONTHLY_BUDGET_USD=20` to start (the estimate for 25 creators is US$4–6), raise when creators grow.
7. **Safety ceiling 500.** *Recommendation:* yes; per platform and per YouTube tab.
8. **Copy not in the mockups** — creator `rejected` ("INFLX couldn't confirm @{handle} is yours" / "Add the account that belongs to you in Profile info."), creator `failing` ("We couldn't refresh your numbers lately. We'll keep trying."), the add/remove sheets and the "Fix accounts" chip as written in the prompt §5.2. *Recommendation:* accept as written.
9. **Admin CSV import.** It is the third writer of followers/engagement (`admin.controller.js:740–764`). *Recommendation:* the import keeps creating creators but stops writing the two numbers; the pipeline measures them after approval.
10. **YouTube detection.** *Recommendation:* two tab-restricted runs per posts run (Videos, Shorts) until the probe proves one run labels items reliably.
11. **Adding a platform after approval** needs the admin ownership check, same as a change. *Recommendation:* yes.
12. **Removing a handle** needs no admin check while the other stays. *Recommendation:* yes.
13. **Existing columns cleared to null** on change, add, remove, not_found, private, rejected. *Recommendation:* yes (verified safe in §3.7).
14. **Instagram engagement when every post hides likes** → "—" (not a comments-only rate). *Recommendation:* yes.
15. **Admin tool location.** *Recommendation:* the creator detail page plus a "Handle checks" tab on `admin/influencers`, and a one-line monthly cost on the analytics page — no new admin section.
16. **Registration stepper.** The mockup shows a 4-step stepper; today registration is one screen. *Recommendation:* two steps (details → social accounts) with the stepper drawn as 2 of 2; no other steps exist yet.
17. **Item 3 "Instagram locked".** Item 3 locked the Instagram field on Profile info; 3b makes it editable with the admin re-check. *Recommendation:* yes, unlock it in 3b.

**Stopping here, as the prompt requires.** Phase 2 starts on your approval and after the probe has run with a valid token.
