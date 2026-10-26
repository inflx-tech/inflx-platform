# post-engagement-stats — spec (LOCKED 26 Oct 2026 — all ten questions decided as recommended; board v1 drawn, mockup lock pending)

> Level 4 of `Docs/APIFY_ANALYTICS_SURVEY_2026-10-25.md`: what shoppers do with a creator's post **inside
> INFLX** — views, likes, comments, shares, saves, shop taps, added to bag — shown to the creator on each of
> her posts and to the brand on each post made for it; and the comment management rules §4.15 already
> promises (the creator replies and hides, the brand reads). Rules: `Docs/OFFER_TERMS_POSTS_RULES.md` §4.15
> (v1.22) and §4.16's screen order "on INFLX · on social media · shopping". No Apify, no money, no migration.
>
> Spec LOCKED 26 Oct 2026 (founder: "I accept all ten recommendations. Lock the post-engagement-stats spec with those decisions."); decisions in `lock.json.decisions`. Nothing is built before the board in `04-preview/` is locked too.
> Every claim below was read in the code on 26 Oct 2026; line numbers are of that day.

## 0. In one paragraph

The shopper app already records everything: a like is a row in `post_likes`, a save in `post_saves`, a
comment in `post_comments`, and every open, share, shop tap, product tap, add-to-bag and finished video is a
row in the `post_events` log. An hourly job even rolls them up — for the feed ranker, which is switched off.
**Nothing shows any of it to the creator or the brand.** Her Post stats screen shows link visits and orders
(Level 3) and, since yesterday, her Instagram and YouTube numbers (Level 2). This contract adds the third
block the rules name first — **"In INFLX"** — to the screens that already exist, from the tables that already
exist, and gives her the comments screen the rules promised: read, reply, hide.

## 1. State today (verified)

| # | Claim | Where |
|---|---|---|
| S1 | A like / a save is one row per (post, follower); unliking deletes the row. | `backend/migrations/141_post_globals.sql:26–41`; `backend/src/services/shopperEngagement.service.js:44–58` |
| S2 | A comment: `author_kind follower\|creator`, `reply_to`, `status visible\|hidden\|removed`, body 1–300 chars; reports table; admin removes or keeps. | `backend/migrations/197_shopper_app.sql:41–70`; `shopperEngagement.service.js:234–241` (add), `:245–285` (report, admin queue, decide); `backend/src/routes/adminShopper.routes.js:15–16` |
| S3 | The schema already allows a **creator's** comment and a **hidden** one; the shopper list reads `author_kind` and labels it, and hides anything not `visible`. **No endpoint writes either** — no creator reply, no hide, no brand read. | `197:44–56`; `shopperEngagement.service.js:203–232` (`comments`: `status = 'visible'`, `author.creator`); searched `backend/src/routes/*.js` for `comments`: only `follower.routes.js:54–56` (shopper read / add / report) and `adminShopper.routes.js:15–16` |
| S4 | `post_events` is an append-only log with 24 event types and 16 surfaces, `follower_id` NULL for guests, `device_id` always; indexed `(post_id, event_type, created_at DESC)`. | `backend/migrations/150_post_event_log.sql:24–42`; `197:73–81`; `backend/src/services/postEvents.service.js:29–41` |
| S5 | The shopper app emits, in batches of ≤100: `impression, open, dwell, watch, complete, replay, pause, buffer, sound_on/off, like, unlike, save, unsave, share, tap_shop, tap_product, tap_creator, tap_brand, add_to_bag, save_product, unsave_product, comment`. **`view` is never emitted** (`open` is the post opened). Guests emit too. | `Packages/Mobile/src/services/events.js:59`; emit sites `Packages/Mobile/src/components/shop/bitsShop.js`, `ShopVideo.js`, `useSeen.js`, `Packages/Mobile/src/screens/shop/CommentsSheet.js`; ingest `POST /v1/follower/events` (`backend/src/routes/follower.routes.js:44`) |
| S6 | Hourly at :17 the roll-up `post_performance` (seen, opens = open+view, shop_taps, saves = save+save_product, likes, completes, score) is rebuilt over the **last 30 days** — read only by the learning feed (`feed_learning_on = 0`) and the admin readiness panel. | `backend/src/jobs/index.js:129`; `backend/src/services/shopperFeed.service.js:312–334`, `:122`, `:337–352`; `197:85–95`, `:105` |
| S7 | Shoppers already see `counts { likes, comments, shares, saves }` on every card: likes = `post_likes`, comments = visible `post_comments`, shares = `post_events 'share'`, saves = `post_saves`. | `backend/src/services/shopperPosts.service.js:251–263` (`countsOf`), `:343` |
| S8 | A sale through a post is `follower_transactions.via_post_id` (shopper-app checkout only); Level 3 already shows orders and commission by channel, "In INFLX" when no link tap came first. | `150:61–65`; `backend/src/services/shopperCheckout.service.js:449`; `backend/src/services/postLinks.service.js:275–305` (`statsOf`) |
| S9 | **Her Post stats (L6)**: `GET /influencers/me/shoppable-posts/:postId/stats` → `statsOf` → `{ title, brand_name, code, live_since, totals{visits,orders,sales,commission}, visits[], orders[], social[], social_summary, own_brand, collaboration_id }`; the screen draws KPI row → "On social media" (+ Update now, hers only) → Visits by channel → Orders by channel. | `backend/src/routes/shoppablePosts.routes.js:26`; `postLinks.service.js:275–305`; `Packages/Mobile/src/screens/create/PostStatsScreen.js:36–96` |
| S10 | **The brand opens the same screen** (`BrandPostStats` = `PostStatsScreen` with `brand:{campaignId,setId}`) from its Set posts list; `GET /campaigns/:id/sets/:sid/posts/:postId/stats` → `brandPostStats` → the same `statsOf`. | `Packages/Mobile/src/navigation/BrandNavigator.js:63`, `:156`; `Packages/Mobile/src/screens/brand/BrandSetPostsScreen.js:55–57`; `backend/src/routes/campaign.routes.js:71`; `postLinks.service.js:362–366` |
| S11 | **The brand's Set posts list** row: title · creator, code, `CL.postRow(totals)` (visits · orders · sales · commission), then the Level 2 `SocialLine`; the set's two KPIs (views on social media, orders). | `BrandSetPostsScreen.js:46–62`; `postLinks.service.js:322–359` (`setPosts`) |
| S12 | **Her Post status (C3)**: Share · code / Stats buttons, then the Level 2 line and "Where you shared it"; `GET /influencers/me/shoppable-posts/:postId` attaches `social`. | `Packages/Mobile/src/screens/create/PostStatusScreen.js:138–150`; `backend/src/services/shoppablePosts.service.js:595–597`; route `shoppablePosts.routes.js:22` |
| S13 | Stats is reached from Post status (live only) and from each live post's row on the Create tab. | `PostStatusScreen.js:141`; `Packages/Mobile/src/screens/create/CreateHomeScreen.js:81`, `:174` |
| S14 | Item 20 own-brand posts go through the same `statsOf` (`own_brand` → Level 2 empty, money reads "sales"). | `postLinks.service.js:293`; `PostStatsScreen.js:55` |
| S15 | Numbers on these screens print in full with Indian grouping (board default M1 of Level 2, `indian()`); the Level 2 words live in `copyStats.js`, the Level 3 words in `copyLinks.js`. | `Packages/Mobile/src/components/content/copyStats.js:12–20`, `:44–72`; `Packages/Mobile/src/components/create/copyLinks.js:46–58` |
| S16 | **Dead code:** v1 posts' `like_count` / `save_count` are computed and then dropped by `hydratePosts`; nothing in `Packages/` reads them. | `backend/src/services/creatorPosts.service.js:306–307`, `:242–297`, `:309` (`NOT cp.v2`) |
| S17 | A post knows whether it is a video (`media_kind image\|video`, `post_kind`). | `backend/migrations/140_creator_posts.sql:35`; `195_shoppable_posts_v2.sql:65` |
| S18 | Rule §4.15: counts kept per post = views (the post opened), likes, comments, shares (share taps inside INFLX), saves; creator replies and hides; brand reads; shown to the creator (each post) and the brand (each post made for it); reporting only, never pay. Rule §4.16 orders the post's Performance screen "on INFLX · on social media · shopping". | `Docs/OFFER_TERMS_POSTS_RULES.md:595–609`, `:626` |
| S19 | Production volume of `post_events` / likes / comments was **not read** (the session's production-read permission refuses it). The admin feed panel at `/admin/feed` already prints the totals (S6 readiness) — the founder can read it there before the lock. | `Packages/brand-web/app/admin/feed/page.js:15` |

## 2. Decisions (proposed 26 Oct 2026, all accepted by the founder the same day)

| # | Decision | Why |
|---|---|---|
| P1 | **The numbers, and their source.** Views = `post_events` `open` + `view` (the post opened, §4.15). Likes = rows in `post_likes`. Comments = `post_comments` with `status='visible'` and `author_kind='follower'` (her replies are not counted). Shares = `post_events 'share'`. Saves = rows in `post_saves`. **Shop taps** = `post_events 'tap_shop'` + `'tap_product'`. **Added to bag** = `post_events 'add_to_bag'`. For a video post, **Finished** = `post_events 'complete'`. No reach, no impressions as a headline number, no engagement rate. | The five of §4.15 plus the two shopping numbers a brand pays for, every one from a column that exists today (S1, S2, S4, S5). Impressions ("seen in the feed") are a feed number, not a post number, and would dwarf the rest. |
| P2 | **All-time since the post went live**, not the ranker's 30-day roll-up. Counted at read time with one query per post over `post_events` (indexed by post) plus three counts; `post_performance` is left to the feed. | §4.15 says "counts kept per post". The 30-day window is the ranker's choice and would make her numbers fall while nothing happened. |
| P3 | **Guests count where they can act.** Views, shares, shop taps, added to bag and finished include guests (device-based, S4–S5). Likes, comments and saves are accounts only (§4.15: they need sign-in; a guest's saves land in `post_saves` when she signs in, `shopperEngagement.service.js:314`). One hint line says so. | That is how the data is; the hint stops "views 1,840 but likes 12?" questions. |
| P4 | **Where, and in which order.** On both Post stats screens (L6: hers C4, the brand's B4) a block **"In INFLX"** sits **between the money row and "On social media"** — the KPI row (visits · orders · to you / commission / sales) stays first as Level 3 locked it, then In INFLX, then On social media, then Visits / Orders by channel. On her Post status (C3) and on the brand's Set posts row (B3) **one line**: "In INFLX · 1,840 views · 212 likes · 38 comments". Nothing on the Create tab's post rows, nothing on the Home tab. | §4.16 names the order "on INFLX · on social media · shopping" for the *blocks*; the money row is the screen's headline and was locked with Level 3 — not re-opened here. Three lines on a list row is the most it takes. |
| P5 | **Comments, in this contract.** From the comments box on Post stats: **C5 her Comments screen** — newest first, 30 a page, shoppers' comments with first name and time, her replies under them, hidden ones greyed with "Hidden · only you see this"; **Reply** (1–300 characters, `author_kind='creator'`, `reply_to` set) and **Hide / Unhide** on each shopper comment; a comment INFLX removed is not shown to her. **B5 the brand's Comments screen** — the same list, read-only, visible comments and her replies only. Shoppers see her reply labelled as the creator's (the app already does, S3); a hidden comment disappears for everyone but her; the comments count excludes hidden ones. Admin's remove wins over her unhide (removed is final). | §4.15 promised reply, hide and the brand's read with "the post-performance board"; the schema and the shopper reader are ready (S2, S3); it is four small endpoints and one screen used by both apps. |
| P6 | **New endpoints:** creator `GET /influencers/me/shoppable-posts/:postId/comments`, `POST …/comments` (reply), `POST /influencers/me/comments/:id/hide`, `POST …/unhide`; brand `GET /campaigns/:id/sets/:sid/posts/:postId/comments`. **Changed payloads (no new routes):** `statsOf` gains `inflx {since, views, likes, comments, shares, saves, shop_taps, bag_adds, finished\|null}`; `setPosts` rows gain `inflx {views, likes, comments}`; the post get (S12) gains the same three. | Three screens already exist and already load these calls; the comments screen is the one new one. |
| P7 | **Own-brand posts (item 20)** get the same block and the same comments screen; he replies as the creator. | They are INFLX posts; `statsOf` already serves them (S14). |
| P8 | **No "Update now", no job, no Apify, no migration.** The numbers are live at read. | Everything is first-party (the survey's point). |
| P9 | **Brand website: not in this contract.** | Level 3 (visits, orders by channel) is phone-only too; the website campaign page shows Level 2 and legacy clicks. A website post-stats page is one later contract for Levels 3 + 4 together (question 4). |
| P10 | **Housekeeping on the way:** the dead `like_count` / `save_count` in `creatorPosts.service.js` (S16) are removed, since this contract becomes the one place in-app numbers are served. | A second, v1-only, unread computation of the same numbers is a trap for the next reader. |
| P11 | **Notifications for new comments: not in this contract.** She finds comments on Post stats. | Needs You / Home (item 19) has its own rules; a "3 new comments" card is a separate decision (question 6). |

## 3. The data (no migration)

Every number comes from tables and indexes that exist. One read of a post's numbers:

```sql
-- post_events, one pass (idx_post_events_post: post_id, event_type, created_at)
SELECT count(*) FILTER (WHERE event_type IN ('open','view'))            AS views,
       count(*) FILTER (WHERE event_type = 'share')                      AS shares,
       count(*) FILTER (WHERE event_type IN ('tap_shop','tap_product'))  AS shop_taps,
       count(*) FILTER (WHERE event_type = 'add_to_bag')                 AS bag_adds,
       count(*) FILTER (WHERE event_type = 'complete')                   AS finished
  FROM post_events WHERE post_id = $1;
-- plus: count(*) FROM post_likes WHERE post_id = $1;
--       count(*) FROM post_saves WHERE post_id = $1;
--       count(*) FROM post_comments WHERE post_id = $1 AND status = 'visible' AND author_kind = 'follower';
```

`setPosts` already calls `statsOf` per post (S11); at today's volume that is fine. If a set ever holds
hundreds of posts, the three counts move into one `unnest` query the way `countsOf` does (S7) — a build
detail, not a decision.

Comment writes reuse `post_comments` as it is: a reply is `author_kind='creator', influencer_id=hers,
reply_to=<id>`; hide is `status='hidden', hidden_at=now()`; unhide is `status='visible', hidden_at=NULL`,
refused when `status='removed'`.

## 4. What is shown, and in which words

| Place | Words |
|---|---|
| Block header (C4, B4) | **In INFLX** |
| Boxes, row 1 | `1,840` views · `212` likes · `38` comments · `19` shares · `64` saves |
| Boxes, row 2 | `97` shop taps · `23` added to bag · (video only) `410` finished |
| Line under the boxes | "Shoppers inside INFLX since 10 Oct. Guests count for views, shares and taps; likes, comments and saves need an account." |
| Comments box | tappable; "38 comments ›" — opens C5 (hers) / B5 (brand) |
| Post status line (C3) | **In INFLX** · 1,840 views · 212 likes · 38 comments |
| Set posts row (B3) | **In INFLX** · 1,840 views · 212 likes · 38 comments |
| No activity yet | "In INFLX · nothing yet" (grey) — a live post nobody has opened |
| C5 header | "Comments · Festive Sarees" · "38 comments · newest first" |
| C5 shopper comment | first name · "2 h ago" · body · **Reply** · **Hide** |
| C5 her reply | "You · 1 h ago" indented under the comment; **Delete** is not offered (question 8) |
| C5 hidden | greyed · "Hidden · only you see this" · **Unhide** |
| C5 reply box | "Reply as Priya" · 300 characters · one yellow **Send** |
| B5 | the same list, no buttons; "Only Priya can reply or hide" |
| Removed by INFLX | not shown to her or the brand |

## 5. Not in this contract

- The shopper app: nothing changes (it already records and shows the counts).
- The brand website (P9). Push or in-app notifications for new comments (P11). The Create-tab post rows.
- A "seen in the feed" (impressions) number, dwell time, sound on/off, replays, buffering — recorded, not shown.
- `post_performance` and the learning feed (item follower-app-v2): untouched.
- Admin: nothing new (the reports queue and the readiness panel stay as they are).
- Level 2 and Level 3 numbers: untouched; the new block sits between them.

## 6. Done means

A live post with real shopper activity in the test database: her Post stats answers the `inflx` block with
the exact counts from the tables (a like then unlike is 0; a hidden comment is not counted; a guest's open
is counted, a guest's like cannot exist); the brand's stats answer the same numbers; the set posts row and
her Post status carry the three-number line; she replies and the shopper list shows the reply labelled as
hers; she hides a comment and it leaves the shopper list and the count; the brand's comments list carries
no buttons; a removed comment cannot be unhidden. Nothing in `follower_transactions`, wallets or escrow is
read or written. All of it fails on today's code (no `inflx` key, 404 on the comment routes).

## 7. The ten questions, decided 26 Oct 2026 (the founder took the recommendation in every one — `lock.json.decisions`)

1. **Which numbers?** The five of §4.15 only (views, likes, comments, shares, saves), or those plus shop taps,
   added to bag and, for videos, finished? — *Recommend the seven (eight for a video): the shopping numbers are
   what a brand pays for, and they exist today.*
2. **Window:** all-time since live, or the last 30 days like the feed? — *All-time.*
3. **Comments in this contract** (reply, hide, brand reads) or numbers first and comments later? — *Together:
   the rules bundle them and the screen is one.*
4. **Brand website:** leave for a later Level 3 + 4 website contract? — *Yes, leave.*
5. **Order on Post stats:** money row first as locked by Level 3, then In INFLX, then On social media — or
   In INFLX at the very top as §4.16 reads literally? — *Money first; the rule orders the blocks, not the headline.*
6. **New comments on Home / Needs You** ("3 new comments on Festive Sarees")? — *Later, its own contract.*
7. **The brand's Set posts row:** carry the In INFLX line (three lines per row) or only on the post's stats? —
   *Carry it; the brand scans the list.*
8. **Her own reply:** can she delete it? — *No: she can hide the whole thread by hiding the shopper's comment;
   a delete is one more rule for no gain. Say if you want it.*
9. **Guests** count for views, shares and taps (hint line says so) — keep, or count accounts only everywhere? —
   *Keep: most shoppers browse as guests (follower-guest-first).*
10. **Own-brand posts** (item 20) included, he replies as the creator? — *Yes.*
