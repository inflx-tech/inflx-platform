# Expected Outputs — post-performance-v2 (spec LOCKED 25 Oct 2026)

> What QA asserts against. Backend: `backend/tests/post-performance-v2.test.js` (real API + DB, Apify mocked
> by `apifyRuns.setMockResolver`). Phone: `Packages/Mobile/src/screens/__tests__/postPerformance.test.js`.
> Web: a parse check of the campaign page plus the Playwright diff of the mockup. "Compiles" is not an output.

## Per-step expected outputs

| # | Step (02-workflow) | Observable output | How QA verifies it |
|---|---|---|---|
| E1 | A1 | A link saved before posting creates **no** `proof_stats` row | `SELECT count(*) FROM proof_stats WHERE content_id=$1` = 0 after the PUT |
| E2 | A2 | `markPosted` creates one `proof_stats` row per Instagram/YouTube link; none for Story screenshots; `tracked_from = posted_at`, `next_due_at = tracked_from`, `platform` and `platform_post_id` parsed (`C9xK2abc`, `Qm8xyz`) | row count 2; column values |
| E3 | A3 | Creator read: `rows[].proofs[].stats.state = 'waiting'` on links, `'story'` on screenshots; words as 01-spec §6 | `GET …/content` JSON; phone test renders the lines |
| E4 | A4 | Level 1 seed: `last_source='level1'`, numbers copied from `creator_social_posts`, `last_read_at` = that row's `updated_at`; `stats.source='level1'` and `stats.sourceAt` in the read | DB + JSON |
| E5 | A5 | One `post_stat_runs` row per platform per job run with `trigger='schedule'`, `actor`, `apify_run_id` (unique), `usage_usd` from the mock, `urls_sent`, `items_received`; one `proof_stat_reads` row per link with `raw` = the item | DB counts and values |
| E6 | A5 | `proof_stats` latest columns = the read; `reads=1`; `next_due_at = tracked_from + 1 day`; `owner_state='match'` | DB |
| E7 | A5 | The Instagram run's input is `{ username: [url1,…] }` (≤50), the YouTube run's `{ startUrls: [{url},…], maxResults: 1, maxResultsShorts: 1, maxResultStreams: 0 }` with the URLs sent **as she pasted them** (the probe read `/shorts/`, `youtu.be` and `watch?v=` each on its own) | mock resolver records the inputs |
| E8 | A6 | Brand read shows `stats = { state:'ok', views:48200, likes:3910, comments:212, likesHidden:false, commentsOff:false, updatedAt, source:'apify', ownerState:'match', kind:'reel' }` | JSON equality |
| E9 | A8 | Update now: `trigger='update_now'` run; `reads=2`; second press within 24 h → `422 UPDATE_TOO_SOON`, no new run | API + DB |
| E10 | A9 | The curve: after reads on day 1,2,3,5,7,10,14,21,30 the next due is +14 d; on day 91 `stopped_at` set, `stop_reason='day_90'`; the job never reads a stopped row | time-travelled `next_due_at` in the test; run count |
| E11 | A10 | `GET /brands/me/campaigns/:id/engagement` new shape: `{ totals:{views,likes,comments,links,linksRead,waiting,updatedAt}, bySet[], byCreator[], links[] }`; no `engagement_rate`, no `deliverables` | JSON schema assertion |
| E12 | A11 | `GET /admin/social/costs` adds `postRuns:{ byPlatform:[{platform,runs,usd}], usd }` and `totalUsd = socialRunsUsd + postRuns.usd`; existing keys unchanged | JSON |
| E13 | B1 | Pay for Sale rows: `proof_stats` rows exist and the post's stats read lists them under `social[]` with `rowKey, type, label, url, stats` | `GET /influencers/me/shoppable-posts/:id/stats` |
| E14 | B3 | Set posts list: each post carries `social:{views,likes,comments,links,missing}`; a post with no links → `missing:true` and the line "Social links not added yet" | JSON + phone test |
| E15 | B4 | An outside row's link is tracked at save (no posting needed) | `proof_stats` row after the PUT on an outside row |
| E16 | B5 | Post taken down → rows `stop_reason='post_left_shop'` after the next job run | DB |
| E17 | C1 | Month usage ≥ budget → job returns `{skipped:'budget'}`, zero `post_stat_runs` rows, one `social_admin_flags` row `kind='budget'` (not a second one the same month) | DB |
| E18 | C2 | Refused run → `post_stat_runs.result='budget'`, `next_due_at` unchanged, no reads | DB |
| E19 | C3 | Instagram `not_found` item, and a YouTube URL with no item back → `last_result='not_found'`, `stopped_at`, `stop_reason='not_found'`; the other links of the batch read normally and are matched by `shortCode` / `id`, not by position | DB |
| E20 | C4 | `likesCount:-1` → `likes NULL, likes_hidden true`; `commentsTurnedOff` → `comments NULL, comments_off true`; words "Likes hidden" / "Comments off" | DB + phone test |
| E21 | C5 | Owner mismatch → `owner_state='other_account'`, exactly one `social_admin_flags` row `kind='owner_mismatch'` across two reads; brand and creator words as §6 | DB + JSON |
| E22 | C6 | No confirmed account on the platform → `owner_state='owner_unknown'`, no flag | DB |
| E23 | C7 | Facebook link → no `proof_stats` row; `stats.state='facebook'` | DB + JSON |
| E24 | C8 | Outside-row link replaced → old row `stop_reason='link_changed'`, new row tracked | DB |
| E25 | C9 | `POST /deliverables/:id/refresh-stats` → 404; `jobs/index.js` exports no `apifyEngagementJob`; `apify.service.js` exports no `scrapePostEngagement`; `mocks/apify_engagement.json` gone | static test (require + route table) |
| E26 | C10 | No Apify URL anywhere in `backend/src` carries `token=` | static grep test |
| E27 | — | Migration 210 is additive: existing tables untouched except the `social_admin_flags.kind` CHECK; dry-run script counts `content_proofs`, `collab_content`, `deliverable_stats` before and after and finds them equal | `scripts/run-210.js --dry` output |

## Data assertions (post-workflow)
- Every `proof_stat_reads` row with `source='apify'` has a `run_id` whose `post_stat_runs.apify_run_id` is set (from the mock: `mock-<ts>-<n>`); `source='level1'` rows have `run_id NULL`.
- `proof_stats.reads = count(proof_stat_reads where source='apify')` per link.
- `sum(post_stat_runs.usage_usd)` for the test month equals the mock's per-run figures × runs, to 4 decimals.
- No row in `proof_stats` for a `content_proofs` row whose `url IS NULL`, whose host is Facebook, or whose content row has `posted_at IS NULL` and whose social row is not `outside`.
- **No money touched:** `escrow_entries`, `wallet_transactions`, `follower_transactions` unchanged by every step (rules §4.16: "social numbers never change pay").
- Attribution untouched: nothing here writes `campaign_influencer_id` anywhere but the new tables' joins.

## Visual evidence required (after the mockup lock, for `06-diff/`)
- Before: the locked board frames rendered by Playwright at the declared viewport.
- After (web): Playwright shot of `/dashboard/campaigns/<id>` Analytics tab on a campaign with two read links and one waiting link.
- After (phone, Maestro): brand content screen with numbers under links; brand Set posts with the social line; creator Post status + Post stats "On social media" block; creator content screen "Numbers come the morning after…".
- Network: `GET …/engagement` new shape; `POST …/content/stats/refresh` 200 then 422; no call to `/deliverables/*/refresh-stats`.
- Admin: `/admin/analytics` cost line with "creators $x · posts $y".
