# Workflow Definition — post-performance-v2 (spec LOCKED 25 Oct 2026)

> Step 3. Each numbered step becomes an assertion in `backend/tests/post-performance-v2.test.js` (real API +
> DB, Apify mocked through `apifyRuns.setMockResolver`, `apifyRuns.service.js:103`) and in the phone's jest
> suite. Defined before any code. Line numbers as of 25 Oct 2026.

## Actors
- **Creator** (approved, confirmed Instagram account `@priya.style` and YouTube channel in `creator_social_accounts`, `ownership='confirmed'`, migration 176:26).
- **Brand** (owner of the campaign; signed collaboration).
- **Admin** (any admin role; `requireAnyAdminRole` default).
- **The clock**: the daily job `post-stats` (new, `backend/src/jobs/post-stats.job.js`, 06:10 Asia/Kolkata, after the `:25` social-measure tick of 05:25 — `jobs/index.js:64`, `:137`).

## Preconditions (fixtures)
- A **Pay for Content** collaboration on item 12's path: agreement with deliverables `reel ×1, story ×2, youtube_short ×1` (`contentGate.rowsOf`, contentGate.service.js:87–106); package approved by the brand (`collab_content.approved_at`).
- A **Pay for Sale** collaboration on item 14's path: one approved shoppable post `K7M2F9`, social rows `s1 reel`, `s2 youtube_video` (content_social_rows, migration 199:21–35), package approved.
- Mock resolver answers `apify~instagram-post-scraper` by URL from `tests/fixtures/apify/instagram-post-by-url.json` and `streamers~youtube-scraper` from `youtube-video-by-url.json` (both copied at build time from `00-survey/probe/`, the real runs of 25 Oct 2026); `usageTotalUsd` US$0.0027 per Instagram result and US$0.004 per YouTube video, no per-run fee (probe: 3 IG URLs → 0.0054 reported, 4 YT URLs → 0.012).
- Probe facts the mock must reproduce: an Instagram `/reel/` URL answers with `url` in `/p/` form; an unknown Instagram URL answers an item `{url, error:'not_found'}`; an unknown YouTube id answers **no item at all**; YouTube items carry `channelUsername` and `channelId`.
- `APIFY_MONTHLY_BUDGET_USD=5`; `apifyRuns.setMockUsage(0)`.

## Workflow A — Pay for Content: from her links to the brand's numbers

1. Creator pastes `https://www.instagram.com/reel/C9xK2abc/` into reel slot 1 (`PUT /influencers/me/invitations/:ciId/content/proofs/reel/1`, item12.routes.js:27) → saved as before (`contentFlow.setProof`, :623–654). **No `proof_stats` row yet** (P2); the screen shows nothing new.
2. Creator pastes `https://youtube.com/shorts/Qm8xyz` into the Short's slot and adds the two Story screenshots → `markPosted` succeeds (`POST …/content/posted`, item12.routes.js:29; contentFlow.service.js:671–690) → **two `proof_stats` rows** appear (`instagram` / `C9xK2abc` / kind null until read; `youtube` / `Qm8xyz`), `tracked_from = posted_at`, `next_due_at = tracked_from` (day 1 = next run), `reads = 0`. The Story slots get no row.
3. Her content screen now shows under each link box: **"Numbers come the morning after you mark it posted"**; under each Story: **"Screenshot · stories can't be tracked"**.
4. (P9) The reel's shortcode already exists in `creator_social_posts` for her account (migration 177:46–64) → the row is seeded at once: `views 31,200 · likes 2,900 · comments 140`, `last_source='level1'`, `last_read_at` = that post's `updated_at`; her screen reads **"31.2K views · 2,900 likes · 140 comments · From her channel numbers, 12 Oct"** (brand wording) / "From your channel numbers" (creator).
5. The clock: `post-stats` runs → `budgetAllows('schedule')` ok → one Apify run per platform with the due URLs batched (`post_stat_runs` rows: `instagram`, `urls_sent 1`, `apify_run_id` from the mock; `youtube`, `urls_sent 1`) → `proof_stat_reads` gets one row per link (`source='apify'`, `result='ok'`, `raw` = the item) → `proof_stats` latest columns updated, `reads = 1`, `next_due_at = tracked_from + 1 day` (day 2 of the curve), `owner_state='match'` (`ownerUsername='priya.style'` = `handle_norm`; YouTube `channelUrl` handle = her `channel_url` handle).
6. Brand opens its content screen (`GET /campaigns/:id/sets/:sid/invitations/:ciId/content`, item12.routes.js:39) → `rows[].proofs[].stats` present → under the reel's link: **"48.2K views · 3,910 likes · 212 comments · Updated today 6:10 am"**; under the Short: **"12.7K views · 880 likes · 41 comments · Updated today 6:10 am"**; under the stories: the screenshot line.
7. Brand confirms live (`confirmLive`, contentFlow.service.js:714–738) → nothing changes in tracking (P5: Pay for Content follows the curve; Q2 may change this).
8. Brand presses **Update now** (`POST /campaigns/:id/sets/:sid/invitations/:ciId/content/stats/refresh`) → a run with `trigger='update_now'`, both links re-read, `reads = 2`; pressing again within 24 h → `422 UPDATE_TOO_SOON` "Numbers were updated 2 hours ago. Once a day." (no run, no cost).
9. Day 2 … day 30, then every 14 days: the job reads on the curve only (P5); on day 91 the row is `stopped_at` set, `stop_reason='day_90'`; the line keeps its last numbers with "Last read 14 Jan".
10. Brand web campaign page, Analytics tab (`GET /brands/me/campaigns/:id/engagement`, engagement.routes.js:10, new shape) → tiles VIEWS / LIKES / COMMENTS / LINKS READ "2 of 2"; "by link" lists the reel and the Short with the same state lines; no ↻ per row; one Update now.
11. Admin opens `/admin/social/costs?month=` (social.routes.js:29) → `postRuns.byPlatform` shows the two runs and their `usd`; `accountMonthUsd` unchanged in meaning (Apify's own figure, apifyRuns.service.js:90–97); the `/admin/analytics` line reads "creators $x · posts $y".

## Workflow B — Pay for Sale: the post's performance screen

1. Creator, package approved, pastes her reel link for row `s1` and her YouTube link for `s2`, marks posted → two `proof_stats` rows, each joined to `K7M2F9` through `content_social_rows.post_id` (migration 199:24).
2. After the first read, creator opens Post status (`PostStatusScreen.js:134–139`) → one line under Share/Stats: **"On social media · 48.2K views · 3,910 likes"**; Stats (`GET /influencers/me/shoppable-posts/:id/stats`, api.js:753) → a new block **On social media** above "By channel": one card per link (Instagram reel · 10 Oct · link · state line; YouTube video · 11 Oct · …).
3. Brand opens Set posts (`GET /campaigns/:c/sets/:s/posts`, api.js:422) → under `K7M2F9`: **"On social media · 60.9K views · 4.8K likes · 253 comments · 2 links"**; a post whose rows have no links yet: **"Social links not added yet"**; Brand post stats (api.js:423) → the same On social media block, read-only, "Open on Instagram / YouTube".
4. Creator adds an **outside** row (item 14 S17, saleLive.service.js:289–306) with a link → tracked **at save** (P2), no posting needed.
5. The shoppable post is taken down (`PostStatusScreen` take-down) → on the next job run every row joined to that post is `stopped_at`, `stop_reason='post_left_shop'` (P5); the lines keep their last numbers.

## Workflow C — the guard rails

1. **Budget:** `apifyRuns.setMockUsage(5.00)` → the job logs `skipped: budget`, writes **no** `post_stat_runs` row, moves no `next_due_at`; admin flag `budget` is raised once (socialMeasure.service.js:38–41 reused). Next day with usage 4.10 → the overdue links are read first.
2. **Refusal mid-run:** the mock answers `{__refuse:true}` → `post_stat_runs.result='budget'`, every link in that batch keeps `next_due_at` (retried next day), no `proof_stat_reads` row.
3. **Unreadable item:** the mock answers an item with `error:'not_found'` for one Instagram URL, and **no item** for one YouTube URL (the probe's two shapes) → each such link `last_result='not_found'`, `stopped_at`, `stop_reason='not_found'`, line "This post is no longer public"; the other links in the batch are stored normally. A YouTube URL with no item back is matched by the ids that **did** come back, never by position.
4. **Hidden likes / comments off:** `likesCount:-1` → `likes null, likes_hidden true` → "Likes hidden"; `commentsTurnedOff:true` → "Comments off" (socialCalc.service.js:63–64, :110 rule).
5. **Other account:** `ownerUsername:'someone_else'` → numbers stored, `owner_state='other_account'`, one `social_admin_flags` row `kind='owner_mismatch'` with `{ciId, rowKey, slot, expected, found}`; brand line "Posted from @someone_else, not her account"; creator line "This link isn't on your account @priya.style"; a second read never raises a second flag while the first is unresolved.
6. **No confirmed account on that platform:** `owner_state='owner_unknown'`, no flag, no line.
7. **Facebook link** on a `facebook_post` row (Pay for Sale) → no `proof_stats` row; line "Facebook numbers come later".
8. **Link changed on an outside row** → old `proof_stats` row `stopped_at`, `stop_reason='link_changed'`; a new row is tracked.
9. **Legacy:** `GET /brands/me/campaigns/:id/engagement` on a campaign with only pre-item-12 deliverables → empty `links[]`, zero tiles, no error; `POST /deliverables/:id/refresh-stats` → 404 (route removed); `jobs/index.js` no longer schedules `apify-engagement`.
10. **Token never in a URL:** every Apify call goes through `apifyRuns.startAndWait` (Authorization header, apifyRuns.service.js:34–37); `apify.service.js:149`'s `?token=` path is deleted with `scrapePostEngagement`.

## Success definition
A link she hands in is read on the curve by a run that appears in `/admin/social/costs` with its Apify run id and cost; its views, likes and comments, with their time, show under the link on both sides of the collaboration and on the shoppable post's stats; the month's scheduled reads stop at the budget; nothing reads `deliverables.live_url` or writes `deliverable_stats` any more.

## Failure / edge workflows
- Apify down (`technical_failure`): run recorded with the error; links keep their due date; lines keep their last numbers; no flag before three failed days in a row (mirrors item 3b `failing_3`).
- A creator deletes the collaboration's post → the job never reads a row whose post is not live.
- A brand of a pre-item-12 campaign → the Analytics tab shows the empty state "No social links yet — numbers appear once a creator marks her content posted."
- `APIFY_MOCK=true` in production by mistake → the mock resolver's default answers `[]` for unknown URLs → `unreadable`, never invented numbers (apifyRuns.service.js:130).
