# Item 3b — Social Numbers: build summary (2026-09-11)

Built to rules v1.12 §2A, the locked mockups, the item 3b prompt and your approval message. **Nothing is
deployed.** Deploying = apply migrations 175–178, push, run the backfill script, publish two OTA bundles.

## 1. Step 0 — token, past runs, `APIFY_INGEST_MODE`
- **Token:** valid, plan **FREE** (US$5 of usage a month). Read from `backend/.env` only; never printed; both env files are git-ignored (`backend/.gitignore` lines 2 and 4); nothing tracked. The new runner sends it in the Authorization header, never in a URL.
- **Past runs (10, all `apify/instagram-scraper`, US$0.13):** four at 06:00 UTC (29 Jul, 31 Jul, 5 Aug, 6 Aug) = the **deliverables job** (`apify-engagement.job`, scheduled `0 6 * * *` without a timezone, so 06:00 UTC; it only runs when live deliverables exist and returns early otherwise, so no fix was needed); three on 25–26 Aug via the API = the **registration scrape** of the three creators whose `scrape_last_run` is 24–25 Aug; three on 7 Sep started from the **Apify web console** by a person (that is the US$0.11 you saw). n8n never ran (`N8N_BASE_URL` unset).
- **Correction to my report:** production was not on mock; the local `.env` and the stale `.env.prod-backup` were. Section 3.4 of the gap report now carries the real probe.
- **`APIFY_INGEST_MODE`:** defined once (`config/env.js`, default `internal`) and read by nothing. It controls nothing; untouched.

## 2. Probe findings relied on (9 runs, US$0.30)
Every field exists under the names the code now reads; Instagram not-found is an item with `error: "not_found"`; hidden likes are `-1`; comments-disabled is a flag; reels carry plays (`videoPlayCount`, the app's "views") and views; `onlyPostsNewerThan` and `oldestPostDate` both filter correctly; YouTube items are labelled `video` / `shorts` / `stream` by tab and streams are excluded by `maxResultStreams: 0`; not-found is `CHANNEL_DOES_NOT_EXIST`; channel totals ride on every item. Two tab runs per posts run kept, as you decided. Fixtures under `backend/tests/fixtures/apify/`.

## 3. What changed
**Database (migrations 175–178, dry run on production clean):** Instagram handle optional (at least one handle enforced); `creator_social_accounts` (one row per creator per platform with its state; 26 rows on production: 25 Instagram + 1 YouTube, all `measuring`); runs with Apify run id and cost; profile snapshots; every post; calculated numbers (history + current); admin flags. On release the five old number columns are cleared for everyone (they were spreadsheet or mock values) until each creator's first real run.

**Server:** the pipeline (`apifyRuns`, `socialCalc`, `socialAccounts`, `socialMeasure`, hourly `social-measure` job at :25), 13 endpoints under `/influencers/me/social`, `/influencers/:id/social/:platform` and `/admin/social/*`; registration takes at least one account, checks formats with your messages, measures nothing and no longer calls n8n; approval starts the first full run; handle change/add after approval clears numbers and waits for admin's Confirm; remove needs the other platform; Check again once a day; Measure now replaces Rescrape; the CSV import no longer writes numbers; budget guard at US$5 counting all INFLX runs from Apify's own usage; credit refusals recorded as `budget`; 500-item ceiling flagged.

**Phone apps (OTA, no native modules):** brand P1 gets a card per platform and the two detail screens (S1–S4); creator gets the two-step registration (R1), the Your numbers row and screen with every state (R3–R5) and the handle-change sheets (R6). Numbers format as 612 / 48.2K / 2.3M / 4.2% / "—" / 9 Sep (year added when not this year).

**Admin (minimal):** Social numbers panel + Measure now + Confirm/Reject on the creator page; "Handle checks" tab with the flags on Influencers; the month's Apify cost on Analytics.

## 4. Real costs and the monthly estimate
| Run | Cost |
|---|---|
| Instagram profile | ≈ US$0.0013 per account |
| Instagram posts | ≈ US$0.0027 per post — this creator (105 posts in 90 days) US$0.28 per posts run; a typical creator with 20–40 posts US$0.05–0.11 |
| YouTube (any run) | ≈ US$0.004 + a fraction of a cent per item |
| **One full run, this creator** | **≈ US$0.30** |

Monthly on the schedule (profile 4.3×, posts 2×): this creator ≈ US$0.60; a typical creator ≈ US$0.15–0.25; **25 creators ≈ US$4–6** (the free plan is US$5, and the deliverables job counts too); **1,000 creators ≈ US$150–250**. The guard will stop scheduled runs on the free plan once the backfill runs. Upgrading is your call.

**Spend today:** probe US$0.30 + end-to-end US$0.73 = **US$1.03** (cap US$3). Account month total now US$1.14 (US$0.11 was there before).

## 5. Tests against the baseline (229 failed / 869 passed / 1098)
- New: 30 backend + 21 mobile tests, all passing. All 74 mobile tests pass.
- Full backend run after the 3b changes: 233 / 895 / 1128 — the 4 newly failing old tests all assumed registration measures (it no longer does) and were updated to the new rule.
- Final full run: **229 failed / 899 passed / 1128 — zero new failures against the baseline**, 30 new tests passing.

## 6. Live verification with the test creator (local database, real Apify)
| | Result |
|---|---|
| a) Registration (two accounts) | Numbers NULL, both accounts waiting for approval, 0 Apify runs, n8n not called |
| b) Approval | Both accounts measuring at once; both runs finished in 88 s |
| c) Numbers vs live accounts | See §7. Instagram followers 192,097 (Instagram showed 192,011 at the probe an hour earlier and 192,107 at the refresh — the account is growing); YouTube subscribers 52,000 (YouTube rounds to 52K); YouTube channel has 3 long videos and 4 shorts, no streams — split matches the channel's tabs |
| d) Brand S1/S2/S3/Discover | Cards `ok` with the numbers; detail payloads complete; Discover row 192.1K / 52.0K / 86.1% |
| e) Creator R3/R4/R5 | Row subtitle + no chip; both cards `ok`; the R5 states not_found / waiting_check exercised in step f |
| f) YouTube handle change | Numbers removed at once, "waiting for INFLX check", brand "Numbers are being updated", admin Confirm → measured (fake handle → not found; real handle → ok again, subscribers back) |
| g) Due dates moved to the past | Weekly profile refresh ran (2 profile runs); 15-day posts refresh ran (2 posts runs); due dates advanced 7 / 15 days |
| h) Five columns | Updated after every success; cleared during the handle change |
| i) Screenshots | **Not possible this session — no phone or emulator attached.** Every screen state is pinned by a render test and every number by the live API payloads saved with the run. Please take the screenshots on your phone after the OTA. |

## 7. The creator's measured numbers, in plain language
**Instagram @_akshayareddyyy** — 192,097 followers, 327 following, 238 posts in total. In the last 90 days: 105 posts (81 reels, 2 photos, 22 carousels), 8.2 a week; 2 posts hide their likes. Average likes 165,043; average comments 278; average reel views 3,382,933.
**Engagement 86.1% = (average likes 165,043 + average comments 278) ÷ followers 192,097 × 100.** It is that high because most of her grid is collaborative reels with photographers and studios whose likes are shared across the co-authors; the rule counts every post on her grid, as written.

**YouTube @lakkireddyakshayareddy-30** — 52,000 subscribers, 7 videos, 3,672,726 total views. In the last 90 days: 7 uploads, 0.5 a week, last upload 4 Sep.
- Long videos (3): average views 749,491; average likes 11,100; average comments 344. **Engagement 1.5% = (all likes 33,300 + all comments 1,031) ÷ all views 2,248,472 × 100.**
- Shorts (4): average views 356,889; average likes 8,725; average comments 76. **Engagement 2.5% = (all likes 34,900 + all comments 303) ÷ all views 1,427,557 × 100.**

## 8. The 31 checks
| # | Check | Result |
|---|---|---|
| 1 | Registration: ≥ 1 account, format errors, no Apify run | Pass (test + live) |
| 2 | Approval queues a full run per handle; pending never measured | Pass (test + live) |
| 3 | Instagram numbers match §3.6 on fixtures and live | Pass (hand recomputation = API) |
| 4 | YouTube split by tab, streams excluded, fallback only when unknown | Pass (tests + probe) |
| 5 | YouTube engagement on views per type | Pass |
| 6 | "—" never 0; 0 posts shows "0" + line | Pass (render test) |
| 7 | Profile refresh after 7 days | Pass (live tick) |
| 8 | Posts refresh after 15 days over the whole window | Pass (live tick) |
| 9 | Failure → stale, retry next day, flag after 3 | Pass (test) |
| 10 | Not found / private copy and actions | Pass (test + live not-found) |
| 11 | Check again only private/failing, once a day | Pass (test) |
| 12 | Handle change/add → clear → admin → measured; reject | Pass (test + live) |
| 13 | Remove only while the other stays | Pass (test) |
| 14 | Five columns updated after success, cleared on the six events | Pass (test + live) |
| 15 | S1 cards | Pass (render test) |
| 16 | S2/S3 texts | Pass (render test) |
| 17 | R3 chip priority | Pass |
| 18 | R4 dates | Pass |
| 19 | Brand privacy | Pass (test) |
| 20 | Budget guard | Pass (test) |
| 21 | Ceiling flagged | Pass (test) |
| 22 | Old paths gone | Pass (source scan test) |
| 23 | Backfill spread | Pass (script; prod dry run shows 26 accounts) |
| 24 | Admin confirm/reject/flags/measure now/cost | Pass (tests + live) |
| 25 | No new test failures vs baseline | Pass — 229 / 899 / 1128, 0 new failures |
| 26 | Credit refusal = `budget` | Pass (test) |
| 27 | No n8n / Apify at registration; approval works IG-only and YT-only | Pass |
| 28 | YouTube-only creator end to end | Pass (test) |
| 29 | Existing creators show "—" / "being updated" until measured | Pass (migration dry run: 26 accounts measuring, columns NULL) |
| 30 | Token never in logs, errors, responses, fixtures, commits | Pass (repo grep clean, server log clean, header auth) |
| 31 | Spend within limits; run log vs console | Pass — US$1.03 today; run log US$0.58 + probe US$0.30 vs Apify US$1.03 (the two profile runs' cost had not been posted by Apify when they finished; the guard uses Apify's account total) |

## 9. Open
- Phone screenshots (no device this session).
- Free plan: the backfill of 26 accounts costs ≈ US$1.5–2 and the monthly schedule ≈ US$4–6; the guard will pause scheduled runs when the US$5 is reached.
- Website discussion items: registration API shape, CSV import numbers, NULL numbers until measured.
