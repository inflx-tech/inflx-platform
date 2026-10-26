# post-engagement-stats — impact (DRAFT 26 Oct 2026)

**Verdict: server (five small endpoints, three payloads widened) + brand app + creator app (one new screen,
three existing screens gain a block or a line). No migration, no job, no Apify, no money. PRODUCTION-IMPACTING
on release (Render + OTA brand + OTA creator) — explicit go required, as always.**

## Affected files (planned)

| File | Change |
|---|---|
| `backend/src/services/postLinks.service.js` | `statsOf` gains `inflx` (one `post_events` pass + three counts); `setPosts` rows gain `inflx {views, likes, comments}` |
| `backend/src/services/shoppablePosts.service.js` | the post get (`:595–597` neighbourhood) attaches `inflx {views, likes, comments}` |
| `backend/src/services/shopperEngagement.service.js` | new: `creatorComments`, `replyAsCreator`, `hideComment`, `unhideComment`, `brandComments` — reusing `comments()`' row shape |
| `backend/src/routes/shoppablePosts.routes.js` | `GET/POST /me/shoppable-posts/:postId/comments`, `POST /me/comments/:id/hide`, `POST /me/comments/:id/unhide` (creator / acting) |
| `backend/src/routes/campaign.routes.js` | `GET /:id/sets/:sid/posts/:postId/comments` (brandAuth) |
| `backend/src/controllers/postLinks.controller.js` (or a new `postComments.controller.js`) | the five handlers |
| `backend/src/services/creatorPosts.service.js` | remove the dead `like_count` / `save_count` (P10) |
| `Packages/Mobile/src/screens/create/PostStatsScreen.js` | the In INFLX block (boxes, hint, comments box → comments screen), creator and brand |
| `Packages/Mobile/src/screens/create/PostStatusScreen.js` | the one line (C3) |
| `Packages/Mobile/src/screens/brand/BrandSetPostsScreen.js` | the one line per row (B3) |
| `Packages/Mobile/src/screens/create/PostCommentsScreen.js` (new) | C5 / B5, one component, `brand` param switches read-only |
| `Packages/Mobile/src/navigation/InfluencerNavigator.js`, `BrandNavigator.js` | register `PostComments` / `BrandPostComments` |
| `Packages/Mobile/src/components/content/copyInflx.js` (new) | the words of spec §4 |
| `Packages/Mobile/src/services/api.js` | five helpers |
| tests | `backend/tests/post-engagement-stats.test.js` (E1–E17); mobile render tests (E18–E20) |

## Affected routes / APIs

| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | `/v1/influencers/me/shoppable-posts/:postId/stats` | + `inflx` block | creator Post stats |
| GET | `/v1/influencers/me/shoppable-posts/:postId` | + `inflx {views, likes, comments}` | creator Post status |
| GET | `/v1/campaigns/:id/sets/:sid/posts` | rows + `inflx {views, likes, comments}` | brand Set posts |
| GET | `/v1/campaigns/:id/sets/:sid/posts/:postId/stats` | + `inflx` block | brand Post stats |
| GET / POST | `/v1/influencers/me/shoppable-posts/:postId/comments` | **new** — list / reply | creator Comments (C5) |
| POST | `/v1/influencers/me/comments/:id/hide`, `…/unhide` | **new** | C5 |
| GET | `/v1/campaigns/:id/sets/:sid/posts/:postId/comments` | **new** — read-only | brand Comments (B5) |

Additive on the four existing payloads: nothing today reads a key named `inflx`, so no screen breaks on an
old app bundle; an old bundle simply does not draw the block.

## Affected workflows (regression surface)
- Post stats, Post status, Set posts — `post-links-codes`, `post-performance-v2`, `item20-own-brand` suites.
- Shopper comments list — `shopper-app` suites (`comments()` is reused, not changed; only `status='visible'` rows are returned, as today).
- Admin reports queue — untouched (`decideComment` is the only writer of `removed`).

## Data and performance
- No migration. `post_events` is read by `idx_post_events_post (post_id, event_type, created_at)`; `post_likes` /
  `post_saves` by their primary keys; `post_comments` by `idx_post_comments_post`.
- `setPosts` already does one `statsOf` per post; this adds four short queries per post. Fine at today's volume
  (14 campaign posts in production); the `unnest` batching of `countsOf` is the pattern if a set grows large.
- Production volume of `post_events` not read (permission); the admin feed panel shows it.

## Money
None. Nothing reads or writes `follower_transactions`, wallets, escrow or commission (E16).

## Migration / deploy / OTA
- No migration. Render (backend), OTA brand + OTA creator (runtime 4). Brand website untouched.
- Release order per the house rule: backend first, then OTA brand, then OTA creator, one publish at a time.

## Out of scope, named
- Brand website (P9); comment notifications (P11); impressions / dwell / sound numbers; `post_performance` and the feed.
