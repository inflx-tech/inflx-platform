# Apify and the four analytics levels — survey, 25 Oct 2026

Founder's question: what role does Apify play across INFLX, and of the four analytics levels, which
exist, which do not, and which need building. Read from the code on 25 Oct 2026 (file:line are of
that day). Verdicts: **LIVE** = built and in production · **PARTIAL** · **MISSING**.

Apify is used for exactly one thing today that matters: **Level 1**. Level 2's scraper exists but
no longer has anything to scrape. Levels 3 and 4 do not need Apify (first-party data) and never will.

---

## Level 1 — a creator's own channel numbers (Instagram + YouTube) · **LIVE**, Apify

What it is: subscribers / followers, engagement, average reel / video / shorts views, recent posts,
measured from the newest 30 posts inside 90 days. Item 3b, live since 11 Sep 2026.

- Pipeline: `socialMeasure.service.js` (runs), `socialCalc.service.js` (the maths),
  `socialAccounts.service.js` (the only writer of the creator's number columns), hourly job
  `social-measure` at :25, budget guard `APIFY_MONTHLY_BUDGET_USD` (US$5 on the free plan).
- Actors: `apify~instagram-profile-scraper`, `apify~instagram-post-scraper`, `streamers~youtube-scraper`.
- Shown on: brand app Creator screen + Discover, creator app Accounts, admin social pages.
- **Defect found from the founder's screenshot (fixed 25 Oct, contract
  `features/backend-defect-youtube-shorts-only-subscribers`):** a channel that only posts shorts
  answers the Videos tab with an error item; the code took that empty answer as the channel snapshot
  and threw away the subscriber count that rode on the Shorts answer. Result: YouTube "—" at the top
  while the shorts numbers were measured. The weekly profile run then wrote a blank snapshot over
  any good one. "Avg video views —" on that creator is correct: she has no long videos.

## Level 2 — performance of the post the creator put on Instagram / YouTube · **PARTIAL (orphaned)**, Apify

What it is: views, likes, comments of the actual campaign post on the social platform.

What exists:
- `apify.service.js` `scrapePostEngagement(url)` — **Instagram only** (needs a `/p/`, `/reel/`, `/tv/`
  URL, apify.service.js:57–60; a YouTube URL throws). Actor id hard-coded `apify~instagram-scraper`.
- Daily job `apify-engagement` at 06:00 (jobs/index.js:90) → table `deliverable_stats`
  (reach, impressions, likes, comments, saves, shares, engagement_rate).
- Read by brand web campaign page via `GET /brands/me/campaigns/:id/engagement` and the on-demand
  `POST /deliverables/:id/refresh-stats`.

Why it is orphaned: the job reads only legacy `deliverables.live_url` with status `live`. Item 12
(Pay for Content, 25 Sep) retired the submit-live / confirm-live endpoints; **nothing in the code
sets `live_url` any more**. Live links now land in `content_proofs(url)` (migration 192), and nothing
scrapes that table. So no collab created since item 12 will ever get social-platform post stats.
Contract `features/post-performance/` is a draft (mockup only, not approved).

Gaps to build:
1. Scrape `content_proofs.url` (one row per proof slot), not `deliverables.live_url`.
2. A YouTube post/video scraper (the YouTube service only reads channels today).
3. A per-proof stats table with a platform column (deliverable_stats has none).
4. A creator-side screen (no mobile screen reads these stats; the old CollabTracking screen is gone).
5. Route the job through the item 3b runner so it gets run ids, cost and the budget guard.

## Level 3 — clicks on the links INFLX generates per social media · **LIVE**, no Apify

What it is: one store link and one post link per platform; clicks counted per platform; the
platform rides into the order. Migration 196, live since 29 Sep 2026 (commit 6cc501ef).

- Links: `inflx.in/p/<code>/<ig|yt|wa|fb|o>` (post), `inflx.in/s/<handle>/<ch>` (store),
  `inflx.in/c/<code>` (collection, counted as "other"). `postLinks.service.js`.
- Clicks: `link_visits` (kind, channel, post, device, counts_until = 30 days). Bots skipped.
- Into orders: `follower_transactions.link_channel` + `via_post_id`, written by the shopper-app
  checkout only (`shopperCheckout.service.js:434–455`), matched by device id.
- Shown on: creator app Post stats (visits by channel, orders / sales / commission by channel),
  Store links (this month per channel); brand app Set posts → post stats.

Gaps (real, smaller):
1. Brand **web** still shows only the legacy `link_clicks` counter (no channel, campaign-scoped);
   per-channel and per-post stats are phone-only.
2. A tap from the web (no device id) can never attach a channel to a later order — it reads "In INFLX".
3. The older `inflx.in/s/<handle>?cid&sid&oid&iid` tracking URL still exists in `utils/tracking.js`
   and `link_clicks` is still written by `/s/:handle` on the API host: two click systems in parallel.
4. `link_visits.real_source` (where the click really came from) is stored but nothing reads it (meant for admin).

## Level 4 — likes, comments, clicks on INFLX's own posts inside the shopper app · **PARTIAL**, no Apify

What exists (recorded well):
- `post_likes`, `post_saves`, `post_comments` (+ reports / moderation).
- `post_events` log: impression, view, complete, tap_shop, tap_product, share, like, add_to_bag,
  open, dwell, watch, replay, tap_creator, tap_brand, comment … sent in batches by the shopper app
  (`POST /follower/events`), guest events re-owned on login.
- Hourly roll-up `post_performance` (seen, opens, shop taps, saves, likes, completes, score; 30 days)
  — read only by the feed ranker (switched off, `feed_learning_on = 0`) and the admin feed panel.
- Shoppers see likes / comments / shares / saves on the cards.

What is missing:
1. **No creator or brand endpoint or screen** shows per-post likes, comments, saves, shares, views,
   opens, shop/product taps, watch-completes or add-to-bag. The data is all there; nothing exposes it.
2. The creator's Post stats screen shows link visits and orders (Level 3) only — in-app engagement
   is not merged into it.
3. `like_count` / `save_count` computed in `creatorPosts.service.js:306–307` are dropped before the
   response (hydratePosts never copies them) and only cover legacy v1 posts — dead code.
4. `post_performance` has no comments / shares / product-tap columns.
5. No creator reply-to-comment path (schema allows `author_kind='creator'`, no endpoint writes it).

---

## Summary table

| Level | What | Verdict | Apify? | Next build |
|---|---|---|---|---|
| 1 | Creator channel numbers | LIVE (+ shorts-only fix built 25 Oct) | yes | — |
| 2 | Campaign post's performance on Instagram / YouTube | PARTIAL, orphaned since item 12 | yes | scrape `content_proofs`, add YouTube, per-proof table, creator screen |
| 3 | Clicks on per-platform links | LIVE | no | brand-web view; web-tap channel; retire the old `/s/` tracking |
| 4 | In-app engagement on INFLX posts | PARTIAL (recorded, not shown) | no | creator + brand per-post stats endpoint and the Post stats screen |

Env facts that bite: `APIFY_MOCK` defaults to **true** unless the env says `false`; `ENABLE_CRONS`
defaults to on. The Level 2 job has no budget guard and bypasses the item 3b runner.
