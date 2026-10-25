# post-performance-v2 — spec (LOCKED 25 Oct 2026; board v1 LOCKED 25 Oct 2026 with M1–M3)

**Level 2 of the analytics survey: how the creator's campaign post is doing on Instagram and YouTube,
read from the links she already hands in, shown to the brand and to her, paid for inside the US$5 Apify
budget.** Spec-stage only (CLAUDE.md §1): nothing under `backend/src`, `backend/migrations` or `Packages/*`
is touched by this folder. The founder answered the 14 questions in §9 on 25 Oct 2026 (every recommendation
accepted, `lock.json.decisions`) and locked the spec. The board `04-preview/mockups/post-performance-v2-v1.html`
(S1, W1–W2, B1–B4, C1–C4) was drawn and locked the same day with its three board defaults M1–M3 (numbers in full
with Indian grouping; Update now on the collaboration screens and her post stats only; "Social links not added
yet" from the posting date). Next: master rules v1.35, then the build.

Supersedes the draft `features/post-performance/` (28 Sep 2026, mockup v1 E1–E7, `lock.json` approved:false,
mockup_locked:false). That draft bundled Level 4 (INFLX in-app engagement, comments) with Level 2 and
pre-dated items 14, 15, 20 and 21. This contract is Level 2 alone. Level 4 stays its own future contract.

Sources: `Docs/APIFY_ANALYTICS_SURVEY_2026-10-25.md:29–52` (the Level 2 verdict) ·
`Docs/OFFER_TERMS_POSTS_RULES.md:612–632` (§4.16 "Social media numbers for each post", v1.22, 11 Oct 2026) ·
master rules v1.34 (Downloads, 24 Oct 2026) §12.1 "Links are checked for shape and platform; reading their
numbers comes later, with post performance" and §12.2 "gives a public link for each row". Every code claim
below was read on 25 Oct 2026; line numbers are of that day.

---

## 1. State today (verified)

| # | Claim | Where |
|---|---|---|
| S1 | The daily scrape job reads only legacy `deliverables.live_url` with `d.status='live'` and upserts `deliverable_stats` | `backend/src/jobs/apify-engagement.job.js:9–17`, `:36–50`; scheduled `'0 6 * * *'` with no timezone (06:00 UTC) at `backend/src/jobs/index.js:90` |
| S2 | Nothing sets `live_url` any more: item 12 retired submit-live; a proof is one `content_proofs` row per slot | `backend/src/routes/deliverable.routes.js:26` (comment), `backend/src/services/contentFlow.service.js:623–654` (`setProof` → `INSERT INTO content_proofs … ON CONFLICT (content_id,row_key,slot)`) |
| S3 | `content_proofs(content_id,row_key,slot,url,screenshot_file_id,updated_at)`; `url` XOR `screenshot_file_id`; `url ≤ 500` | `backend/migrations/192_item12_content.sql:128–137` |
| S4 | A link is checked for **shape and host only, never fetched**; hosts per platform: instagram, youtube (incl. youtu.be), facebook (incl. fb.watch) | `contentFlow.service.js:611–620` (`validLink`), `backend/src/services/contentCopy.js:172–177` (`HOSTS`) |
| S5 | A row's platform comes from its type: Pay for Content rows from the agreement (`rowsOf`), Pay for Sale rows from `content_social_rows` (one row = one approved shoppable post + one place; `outside` rows are links only) | `backend/src/services/contentGate.service.js:87–106`, `:111–123`; `contentCopy.js:116–123` (`SALE_TYPES`), `:163–166` (`PLATFORM_OF_TYPE`); `backend/migrations/199_item14_sale_going_live.sql:21–35` |
| S6 | Links can change until she marks posted (`clearProof` refused once `posted_at`, except outside rows); `markPosted` needs every package slot filled | `contentFlow.service.js:657–668`, `:671–690` |
| S7 | The content row carries the clocks this spec needs: `posted_at`, `live_confirmed_at`, `t3_released_at`, `completed_at` | `backend/migrations/192_item12_content.sql:35`, `:40`, `:45–46` |
| S8 | `scrapePostEngagement` is Instagram-only (`/p/`, `/reel/`, `/tv/` shortcode or throw), actor hard-coded `apify~instagram-scraper`, sync endpoint with the token **in the URL**, no run id, no cost | `backend/src/services/apify.service.js:46–80`, `:57–60`, `:71`, `:149` |
| S9 | The YouTube service reads channels only (`fetchChannel`, `maxResults:1`), exports no video reader | `backend/src/services/youtube.service.js:106`, `:136–139`, `:239` |
| S10 | `deliverable_stats` has no platform column: `deliverable_id, reach, impressions, likes, comments, saves, shares, engagement_rate, scraped_at` | `backend/migrations/001_initial_schema.sql:267–279` |
| S11 | The item 3b runner records run id and cost, classifies a credit refusal as `budget`, mocks by actor+input | `backend/src/services/apifyRuns.service.js:52–87` (`startAndWait`), `:30–32`, `:108–131` (`defaultMock`) |
| S12 | The budget guard reads the **whole account's** month usage from Apify (`/users/me/limits`), falls back to summing `creator_social_runs`; it gates only `schedule`/`retry`/`backfill` triggers | `apifyRuns.service.js:90–97`; `backend/src/services/socialMeasure.service.js:22`, `:27–43`; budget `APIFY_MONTHLY_BUDGET_USD` default 5 at `backend/src/config/env.js:60` |
| S13 | Run log `creator_social_runs.account_id` is `NOT NULL → creator_social_accounts`; admin costs = that table joined to accounts, grouped by platform | `backend/migrations/177_item3b_social_runs_snapshots_posts.sql:6–24`; `backend/src/controllers/social.controller.js:132–141`; route `backend/src/routes/social.routes.js:29`; shown at `Packages/brand-web/app/admin/analytics/page.js:205–208` |
| S14 | Item 3b already normalises a single Instagram item and a single YouTube item (hidden likes → null, comments off → null, reel views = `videoPlayCount ?? videoViewCount`) | `backend/src/services/socialCalc.service.js:60–77`, `:93–116` |
| S15 | Item 3b already stores the creator's newest posts with `url, likes, comments, views, owner_handle` | `backend/migrations/177…:46–64` (`creator_social_posts`); written at `socialMeasure.service.js:132–140` |
| S16 | The creator's confirmed accounts: `creator_social_accounts(platform, handle_norm, channel_url, ownership)` | `backend/migrations/176_item3b_social_accounts.sql:17–42` |
| S17 | The brand **web** campaign page reads `GET /brands/me/campaigns/:id/engagement` (deliverables + `deliverable_stats`, follower-based ER, "reel views in the impressions column") and calls `POST /deliverables/:id/refresh-stats` per deliverable and for all | `backend/src/services/engagement.service.js:23–44`, `:72–82`, `:100–109`; `backend/src/routes/engagement.routes.js:10`, `backend/src/routes/deliverable.routes.js:57`; `Packages/brand-web/app/dashboard/campaigns/[id]/page.js:160`, `:293–320`, Analytics tab `:850–950`, footnote `:946–948`; `Packages/brand-web/lib/api.js:386`, `:597` |
| S18 | The phone defines both calls but **no screen uses them** | `Packages/Mobile/src/services/api.js:567`, `:852` (only hits for `/engagement` and `refresh-stats` under `Packages/Mobile/src`) |
| S19 | Where the links are shown today: creator content screen (link boxes per slot), brand content screen (`LinkLine12` per proof), both Going live screens (item 14) | `Packages/Mobile/src/screens/influencer/ContentScreen.js:63–68`, `:175–179`; `Packages/Mobile/src/screens/brand/BrandContentScreen.js:216–224`; `Packages/Mobile/src/screens/brand/BrandSaleLiveScreen.js:130`; `Packages/Mobile/src/screens/influencer/SaleLiveScreen.js:1–12` |
| S20 | A post's stats today are Level 3 only (visits, orders, commission by channel): creator `PostStatsScreen` reached from `PostStatusScreen`'s Stats button; brand `BrandSetPostsScreen` → `BrandPostStats` | `Packages/Mobile/src/screens/create/PostStatsScreen.js:1–5`, `:26`; `PostStatusScreen.js:134–139`; `BrandSetPostsScreen.js:1–6`, `:48`; `api.js:422–423`, `:753` |
| S21 | Item 20's own-brand posts keep their own "where did you share it" links in `post_share_places(place, link)`; nothing reads them for numbers | `backend/migrations/206_own_brand.sql:67–78`; `Packages/Mobile/src/components/ownbrand/PlacesCard20.js:1–6` |
| S22 | `APIFY_MOCK` is on unless the env says `false`; crons off when `ENABLE_CRONS=false`; cron tz `Asia/Kolkata` | `env.js:42`; `jobs/index.js:59–60`, `:64` |
| S23 | Admin flags accept only `failing_3`, `budget`, `ceiling` | `backend/migrations/178_item3b_social_metrics_flags.sql:49` |

**Production counts (read 25 Oct 2026 after the founder's go; `00-survey/prod-counts-2026-10-25.md`):**
14 proof links (11 Instagram reels, 2 YouTube Shorts URLs, 1 `youtu.be`; no Facebook, no Story screenshots)
on 4 completed collaborations posted 1–10 Oct; `deliverable_stats` has 0 rows and never had a scrape;
13 Pay for Sale social rows, all package rows; Level 1 spent US$1.29 in September and US$2.49 so far in
October (a full Instagram run ≈ US$0.21, a full YouTube run ≈ US$0.23); 27 Instagram and 26 YouTube
accounts confirmed for the ownership check; all 14 links match a Level 1 post by URL (one query, not spot-checked).

## 2. What the Apify store says (read 25 Oct 2026, apify.com actor pages) — and what the probe proved

**Probe done 25 Oct 2026 (`00-survey/PROBE-2026-10-25.md`, US$0.02):** Instagram post URLs in `username[]`
work for `/reel/` and `/p/` (answer carries `/p/<shortcode>`; match by `shortCode`); YouTube reads `/shorts/`,
`youtu.be` and `watch?v=` each on its own and returns `channelUsername` and `channelId`; per read US$0.0027
Instagram / US$0.004 YouTube, no per-run fee; an unknown Instagram URL answers an `error:'not_found'` item
(and is still charged), an unknown YouTube id answers no item at all; a YouTube run of four URLs took 143 s;
hidden likes (`likesCount:-1`) and a collaborative post owned by another account both turned up in the sample.

| Actor | Takes a single post URL? | Fields that matter | Price on the **Free** plan | Notes |
|---|---|---|---|---|
| `apify~instagram-post-scraper` (already `APIFY_IG_POSTS_ACTOR`, env.js:58) | Yes — post/reel URLs pasted in the `username` field (**probe: both `/reel/` and `/p/` read; the answer's `url` is always `/p/<shortcode>`**); `resultsLimit` and the date filter are ignored for URLs | `likesCount` (−1 = hidden, **seen in the probe**), `commentsCount`, `videoViewCount`, `videoPlayCount` (video only), `ownerUsername`, `ownerId`, `coauthorProducers[]`, `taggedUsers[]`, `paidPartnership`, `timestamp`, `type`, `productType`, `shortCode` | US$0.0027 per result (**measured**; US$2.30 per 1,000 on Starter) | Same actor family item 3b already mocks and normalises (S11, S14). A not-found URL answers an `error:'not_found'` item and is still charged. |
| `apify~instagram-scraper` (today's hard-coded actor, S8) | Yes — `directUrls` with `/p/` or `/reel/` | same as above; **no** `sharesCount` | US$2.70 per 1,000 results | No reason to keep it: same price, a second fixture family |
| `apify~instagram-reel-scraper` | Yes — direct reel URLs | adds shares only with `includeSharesCount`, **paying plans only** | US$2.60 per 1,000 | Not worth a third actor for a number we cannot have on the free plan |
| `streamers~youtube-scraper` (already `APIFY_YOUTUBE_ACTOR`, env.js:53) | Yes — "a link to a YouTube video" in `startUrls`; **probe: `/shorts/`, `youtu.be` and `watch?v=` each read on their own** | `viewCount`, `likes`, `commentsCount` (+`commentsTurnedOff`), `date`, `duration`, `channelUrl` (handle form), `channelName`, `numberOfSubscribers`, and (probe) `channelUsername`, `channelId`, `collaborators`; **no shares, no dislikes** | US$0.004 per video on the Free plan (**measured**) | No URL rewriting needed. A non-existent id answers **no item**; match answers to URLs by `id`, never by position. Four URLs took 143 s. |

Consequences the old board did not know: **shares are not available on either platform on the free plan**
(the v1 mockup drew "640 shares" under an Instagram reel). Instagram `videoPlayCount` is what Instagram
calls views (socialCalc.service.js:65). Hidden likes and comments-off are real states, not zeros.

## 3. Decisions (proposed 25 Oct 2026, all accepted by the founder the same day — see §9)

| # | Decision | Why |
|---|---|---|
| P1 | **Source of truth = `content_proofs.url`** (S2–S3). Every link with an Instagram or YouTube host becomes a *tracked link*. Screenshots (Stories) and Facebook links are never scraped; they show their own line. `deliverables.live_url` and `deliverable_stats` are retired. | Rules §4.16: "Pay for Content: the live links she already hands in … are used"; v1.34 §12.1 says their numbers come "with post performance". Nothing else carries links (S2). |
| P2 | **Tracking starts when the link is final:** a package row's links the moment `collab_content.posted_at` is stamped (S6, S7); an `outside` row's link (item 14 S17) the moment it is saved. A link cleared or replaced before posting is never read. | A read of a link she may still change is money for nothing. |
| P3 | **One actor per platform, both already in env:** `apify~instagram-post-scraper` with the URLs in `username[]`, `streamers~youtube-scraper` with the URL in `startUrls[]`. Up to **50 URLs per run**, one run per platform per day. `scrapePostEngagement` and `mocks/apify_engagement.json` are deleted; the `youtube.service` channel reader is untouched. | Fewer runs, one fixture family, one normaliser (S14). Batching keeps any per-run start fee (unconfirmed, §7) from multiplying. |
| P4 | **Every run goes through `apifyRuns.startAndWait`** (S11) and is written to a new run table `post_stat_runs` (one row per Apify run, platform, actor, `apify_run_id`, `usage_usd`, counts). `/admin/social/costs` gains a `postRuns` block by platform and a combined month total; the `run_log` fallback of `monthSpend` sums both tables. | The founder's requirement; `creator_social_runs.account_id NOT NULL` (S13) cannot hold a batched run that spans creators. The Apify-side budget figure already counts these runs (S12), so the guard needs no new arithmetic. |
| P5 | **Read schedule (budget-aware; replaces §4.16's "daily for 30 days then weekly"):** reads on day 1, 2, 3, 5, 7, 10, 14, 21 and 30 after tracking starts, then every 14 days to day 90, then it stops. Pay for Content follows the same curve (not "until the final payment", which would give ~5 reads and then silence). A Pay for Sale link also stops when its shoppable post leaves the shop (`content_social_rows.post_id` → post state not live). | §5 shows the rule as written costs the whole US$5 on ~40 links. 13 reads per link per quarter keeps Level 1 running. |
| P6 | **Scheduled reads obey the item 3b budget guard** (`budgetAllows('schedule')`, S12) and yield **before** Level 1: the post-stats job runs after the hour's social-measure tick and skips when the month's spend is at or above `APIFY_MONTHLY_BUDGET_USD`; Level 1 keeps its approval / handle-confirm / Measure-now runs. A skipped day is caught up on the next run (the due date stays due). | Level 1 numbers are what brands pick creators by; Level 2 is reporting after the fact. |
| P7 | **"Update now"** on both sides of a collaboration (brand and creator), one per collaboration per 24 h, budget-gated like a scheduled read (not exempt like item 3b's Measure now). Admin's Measure-now-style button on the collaboration is exempt. | A free button on a brand screen is a way to spend the budget by tapping. |
| P8 | **Ownership check after the first read, not at save time** (§4.16 "refused when added … flagged if the scrape shows a different owner"): she is the owner when her confirmed handle (S16, `handle_norm`) is the read's `ownerUsername` **or** appears in `coauthorProducers[].username` (Instagram collaborative posts, seen in the probe), or when the YouTube `channelUsername` / `channelId` matches her confirmed channel (`channel_url`, `platform_account_id`). Otherwise the numbers are kept, the link is marked `other_account`, an admin flag is raised (new kind `owner_mismatch`, S23) and the brand sees "Posted from @other, not her account". A creator with no confirmed account on that platform is `owner_unknown`, never flagged. | Refusing at save would mean an Apify run inside a PUT (37–143 s in the probe, money) on every paste; and a collaborative post is legitimately hers while owned by another account. |
| P9 | **Zero-cost seed from Level 1:** when a tracked link's shortcode / video id matches the URL of a row in `creator_social_posts` for that creator (S15; match on the URL, since Instagram's `platform_post_id` is a numeric id, socialCalc.service.js:67), its `likes, comments, views, updated_at` are copied in as a first reading labelled with Level 1's date (`source='level1'`). | Free; today all 14 production links match a Level 1 post (`00-survey/prod-counts-2026-10-25.md`). |
| P10 | **Numbers shown:** views (reels, videos, Shorts; `—` for a photo post), likes (or "Likes hidden"), comments (or "Comments off"). **No shares, no reach, no saves, no engagement rate.** The brand web's AVG ER tile goes (follower-based ER is item 3b's retired basis). | §2: shares need a paid plan; reach/saves need the Business API; the old footnote (S17 `:946–948`) said so already. |
| P11 | **Retirement:** `apify-engagement` unscheduled and deleted; `POST /deliverables/:id/refresh-stats` and `scrapePostEngagement` removed; `GET /brands/me/campaigns/:id/engagement` keeps its path with the new shape; `deliverable_stats` is left in place this release and dropped by a later housekeeping migration once the new table has a month of reads. | Nothing in production can write `deliverable_stats` today (S1–S2). |
| P12 | **Item 20's `post_share_places.link` is not tracked in this contract** (S21). | "Nobody approves it and nothing depends on it" (PlacesCard20.js:3–4). Open question 6. |

## 4. The data (migration 210, additive)

Numbering: `backend/migrations/` ends at `209_item21_content_posts.sql` today.

```
post_stat_runs                       -- one row per Apify run (P4)
  id uuid pk · platform ('instagram','youtube') · trigger ('schedule','update_now','admin','backfill')
  actor text · apify_run_id text UNIQUE WHERE NOT NULL · started_at · finished_at
  result ('success','technical_failure','budget','running') · error text
  usage_usd numeric(10,4) default 0 · urls_sent int · items_received int · detail jsonb

proof_stats                          -- one row per tracked link; REPLACES deliverable_stats (P1)
  content_id, row_key, slot           pk, fk → content_proofs ON DELETE CASCADE
  platform ('instagram','youtube') · url_sent text · platform_post_id text · kind ('reel','post','carousel','long','short')
  tracked_from timestamptz · reads int default 0 · next_due_at timestamptz · stopped_at · stop_reason ('day_90','post_left_shop','link_changed','not_found','private')
  -- the latest reading, denormalised for the screens:
  views bigint · likes bigint · likes_hidden bool · comments bigint · comments_off bool
  published_at timestamptz · owner_handle text · owner_state ('match','other_account','owner_unknown')
  last_read_at timestamptz · last_source ('apify','level1') · last_result ('ok','not_found','private','unreadable')
  updated_at

proof_stat_reads                     -- every reading, append-only
  id uuid pk · content_id,row_key,slot fk → proof_stats ON DELETE CASCADE
  run_id uuid fk → post_stat_runs (null for a level1 seed) · measured_at · source · result
  views · likes · likes_hidden · comments · comments_off · owner_handle · raw jsonb (the item, for the next field-name drift)

ALTER social_admin_flags: kind gains 'owner_mismatch' (S23)
```

Platform and `platform_post_id` are derived **from the URL at tracking time**: Instagram `/(p|reel|tv)/<shortcode>`,
YouTube `watch?v=<id>`, `/shorts/<id>`, `youtu.be/<id>` (sent to Apify as `watch?v=` if the probe says Shorts
URLs are not read on their own). A link that changes after tracking (outside rows) closes the old row
(`link_changed`) and opens a new one.

## 5. Cost (why P5 is not the rule as written)

Per read on the Free plan, **measured by the probe**: Instagram US$0.0027, YouTube US$0.004, no per-run
start fee (§2, `00-survey/PROBE-2026-10-25.md`). Level 1 spends from the same US$5 (S12): US$2.65 by the
evening of 25 Oct, so ≈ US$3 a month and ≈ US$2 of headroom. Production today: 14 links (11 Instagram, 3 YouTube), all on completed collaborations.

| Links being tracked at once | §4.16 as written (30 daily + weekly) — month 1 | P5 curve — month 1 (9 reads) | P5 — whole quarter (13 reads) |
|---|---|---|---|
| **14 (today)** | **US$1.25**, then ≈ US$0.17 a week | US$0.38 | US$0.55 |
| 40 | US$3.2–4.8 | US$1.0–1.4 | US$1.4–2.1 |
| 100 | US$8–12 (over budget alone) | US$2.4–3.6 | US$3.5–5.2 |

At today's 14 links the rule as written fits inside the headroom. It stops fitting at about 40 live links,
where it leaves Level 1 nothing; the curve keeps both under US$5 until about 100 links per quarter, which
is the point to buy the Starter plan, not to change the design. The 14 existing links are 15–24 days old:
whether to backfill them when this ships (trigger `backfill`, ≈ US$0.05 for all 14) is part of question 1.

## 6. What is shown, and in which words

Every number carries its time: "Updated today 6:10 am" / "Updated 3 days ago". Words follow the mono rule
(white/black, one yellow button; waiting = blue). The board (`04-preview/`, drawn after the lock) gives these
screens their letters.

**States of one link (same words on every screen)**

| state | line |
|---|---|
| waiting | "Numbers come the morning after you mark it posted" (creator) / "…after she marks it posted" (brand) |
| ok | "48.2K views · 3,910 likes · 212 comments · Updated today 6:10 am" (a photo post: "3,910 likes · 212 comments") |
| likes hidden | "48.2K views · Likes hidden · 212 comments" |
| comments off | "… · Comments off" |
| level1 seed | the same line with "From her channel numbers, 12 Oct" until the first read |
| unreadable | "Couldn't read this link · we'll try again tomorrow" |
| not_found / private | "This post is no longer public" (tracking stops) |
| other_account | brand: "Posted from @other, not her account" · creator: "This link isn't on your account @priya.style" |
| story | "Screenshot · stories can't be tracked" |
| facebook | "Facebook numbers come later" |
| stopped (day 90 / post left the shop) | the last line, with "Last read 14 Jan" |

**Brand web — campaign page, Analytics tab** (`page.js:850–950`): tiles become **VIEWS · LIKES · COMMENTS · LINKS READ** ("12 of 14 · 2 waiting"); "by set" and "by creator" lines become "views · likes · comments · n links"; "by deliverable" becomes **by link**: creator · row label ("Instagram reel 1 of 2") · the link · its state line; one **Update now** per campaign (P7) replaces the per-row ↻; the footnote becomes "Views, likes and comments are read from the public post. Shares, reach and saves aren't public. Read on day 1, 2, 3, 5, 7, 10, 14, 21, 30, then every two weeks for three months."

**Brand app:** BrandContentScreen (S19) — under each `LinkLine12`, the state line; BrandSaleLiveScreen — the same under each row's link; BrandSetPostsScreen (L7) — a second line per post "On social media · 60.9K views · 4.8K likes · 253 comments · 2 links" or "Social links not added yet"; BrandPostStats (S20) — a new block **On social media** above "By channel": one card per link (place label · date · link opens the app · state line); Update now at the foot of the content / Going live screens.

**Creator app:** ContentScreen and SaleLiveScreen (S19) — the state line under each link box once posted; PostStatusScreen (S20 `:134–139`) — one line under the Share/Stats buttons "On social media · 48.2K views · 3,910 likes"; PostStatsScreen — the same **On social media** block as the brand's; Update now once a day.

**Admin:** `/admin/analytics` cost line (S13) reads "Apify this month: $2.31 of $5 · creators $1.80 · posts $0.51"; the flags list gains "Posted from another account" with the collaboration and both handles; the admin collaboration page gets Measure now for its links (exempt from the budget, P7).

## 7. Step-0 probe — DONE 25 Oct 2026 (US$0.02; `00-survey/PROBE-2026-10-25.md`, raw answers in `00-survey/probe/`)

Two real runs through `apifyRuns.startAndWait` with `APIFY_MOCK=false` from a laptop; the raw answers are
copied to `backend/tests/fixtures/apify/instagram-post-by-url.json` and `youtube-video-by-url.json` at build
time. The three questions as asked, each answered in the probe note:
1. Does `apify~instagram-post-scraper` read a `/reel/` and a `/p/` URL pasted in `username[]`, and what is `usageTotalUsd` for a 2-URL run (per-run start fee?).
2. Does `streamers~youtube-scraper` read a `watch?v=` URL, a `/shorts/` URL and a `youtu.be/` URL on its own (production holds two Shorts URLs and one `youtu.be`, no `watch?v=`); what are `channelUrl` / `channelUsername` for the ownership check; cost per run.
3. A deleted / private post on each platform: the item shape (`error`?) that becomes `not_found` / `private`.
Answered: 1 yes, US$0.0027, no run fee; 2 yes for all three URL shapes, `channelUsername` + `channelId` present,
US$0.004; 3 Instagram answers an `error:'not_found'` item, YouTube answers no item; a private post was not
probed (no safe target) and is handled as item 3b handles a private profile.

## 8. Not in this contract

Level 4 (INFLX in-app likes/comments/saves and the comments screen — the old draft's E4), Level 3 changes
(brand-web per-channel clicks), Facebook scraping, shares/reach/saves, engagement rate, item 20 share places
(P12), a paid Apify plan, admin settings for the schedule (env + code constants only), the shopper app.

## 9. The 14 questions, decided (25 Oct 2026; the founder took the recommendation in every one — `lock.json.decisions`)

Decided: 1 thin curve · 2 same 90 days for Pay for Content · 3 no shares, no paid plan · 4 Update now for brand and
creator once a day per collaboration, budget-gated · 5 flag after the first read, brand sees it · 6 own-brand places
not tracked · 7 Level 1 seed shown first · 8 Level 1 wins the budget · 9 legacy removed, table dropped later ·
10 LINKS READ replaces AVG ER · 11 stop at day 90 · 12 one release for all three · 13 Facebook accepted, not read ·
14 the 14 existing links read once at ship. The questions as asked:

1. **Read schedule.** Keep §4.16 as written (daily 30 days, then weekly, ≈ US$3–5 a month at 40 links, §5) or the P5 curve (day 1, 2, 3, 5, 7, 10, 14, 21, 30, then every 14 days to day 90)? If the rule stays, the budget must rise (Starter plan, US$39/month) or Level 1 yields.
2. **Pay for Content after the final payment.** §4.16 says "daily until the final payment" (≈ 7 days after the brand confirms). Stop there, or the same 90-day curve as Pay for Sale (P5)?
3. **Shares.** Not available on the Free plan on either platform (§2). Drop the shares column from the screens (P10), or buy Starter for Instagram shares only?
4. **Update now.** Brand and creator, once per collaboration per 24 h, budget-gated (P7) — or brand only, or admin only?
5. **Ownership mismatch.** Flag after the first read (P8) rather than refuse at save time. Should the brand see "Posted from @other" or only admin?
6. **Own-brand posts (item 20).** Track `post_share_places.link` too (same cost per link; he is both sides, nobody waits on it)? P12 says not now.
7. **Level 1 seed.** Show the Level 1 reading as the first number with its own date (P9), or wait for the first paid read?
8. **Budget priority.** When the month's US$5 is nearly spent, post reads yield to creator channel numbers (P6). Agreed?
9. **Retire the legacy now.** Unschedule and delete `apify-engagement`, remove `refresh-stats`, keep `deliverable_stats` one release then drop (P11)?
10. **Brand web tiles.** Drop AVG ER (follower-based, S17 `:100–109`) for LINKS READ (P10)?
11. **Day 90 stop.** After day 90 a link is read no more unless someone presses Update now (P5). Or monthly forever while the post is live?
12. **Order of screens.** Redesign sequence is brand-web → brand app → creator app. Ship all three in one release (one OTA each) or brand-web first?
13. **Facebook.** Accepted and shown with "Facebook numbers come later" (§4.16, P1) — confirm no Facebook actor is bought now.
14. **Backfill.** The 14 links already in production (all on completed collaborations, 15–24 days old) — read them once when this ships, or start tracking only from new postings?
