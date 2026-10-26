# post-engagement-stats — expected outputs (DRAFT 26 Oct 2026)

> Step numbers are those of `02-workflow.md`. "Compiles" is NOT an expected output. All backend checks run
> against the real API and the real test database with shopper activity written through the shopper app's
> own endpoints (`POST /follower/events`, like, save, comment), never by inserting counts.

| # | Step | Observable output | How it is verified |
|---|---|---|---|
| E1 | 1–4 | A live post with: 3 guest opens + 2 account opens, 1 share, 2 shop taps + 1 product tap, 1 add-to-bag, a video `complete`; 2 likes (one later unliked); 1 account save; 3 shopper comments (one hidden, one removed by admin) + 1 creator reply. `GET …/stats` answers `inflx = { views 5, likes 1, comments 1, shares 1, saves 1, shop_taps 3, bag_adds 1, finished 1, since <live_since> }` | API + database; **fails today** (no `inflx` key) |
| E2 | 3 | `GET /influencers/me/shoppable-posts/:id` carries `inflx { views 5, likes 1, comments 1 }` | API |
| E3 | 6 | A live post with no activity: `inflx` all zeros, `finished null` for an image post | API |
| E4 | 4 | An image post: `finished` is `null`; a video post: a number | API |
| E5 | 7 | `GET …/comments` (creator): newest first, the hidden one present with `hidden: true`, the removed one absent, her reply nested under its parent with `author.creator true`, `total` = visible shopper comments | API; **fails today** (404) |
| E6 | 8 | Reply: 201; the row is `author_kind='creator', influencer_id=hers, reply_to=<id>`; the shopper list `GET /follower/posts/:id/comments` shows it with `author.creator true`; the count is unchanged | API + database |
| E7 | 9–10 | Hide: 200, `status='hidden', hidden_at` set; gone from the shopper list; `inflx.comments` drops by one. Unhide: back, count back | API + database |
| E8 | 11 | Unhide a removed comment: 409 with the message; status stays `removed` | API + database |
| E9 | 12 | Empty / 301-char reply: 422 with the shopper app's message; `reply_to` of another post's comment: 404 | API |
| E10 | 13 | Another creator on her post: 404 on all four routes | API |
| E11 | 14 | `GET /campaigns/:id/sets/:sid/posts` rows carry `inflx { views, likes, comments }`; a post with no activity carries zeros | API |
| E12 | 15 | The brand's `…/posts/:postId/stats` carries the same `inflx` block as E1 | API |
| E13 | 16 | The brand's `…/comments`: visible comments and her replies only, no hidden, no removed; no `can_hide` / `can_reply` keys | API; **fails today** (404) |
| E14 | 17 | Another brand: 404 | API |
| E15 | 18 | Own-brand post: `inflx` present; his reply writes `author_kind='creator'` | API |
| E16 | all | Nothing reads or writes `follower_transactions`, `wallet_transactions`, `escrow_entries`: the suite's money snapshot before and after is identical | database |
| E17 | P10 | `like_count` / `save_count` are gone from `creatorPosts.service.js`; the v1 posts list answers as before | grep + the existing creator-posts suite |
| E18 | C3, C4 | Creator app render tests: the In INFLX line on Post status; the block with eight boxes (seven for an image post) and the hint on Post stats; "nothing yet" on a post with zeros; the comments box navigates to C5 | `Packages/Mobile` jest render tests |
| E19 | C5 | Comments screen: list, Reply opens the box, Send calls the reply endpoint, Hide / Unhide call theirs, a hidden row is greyed with its line; the brand variant has no buttons and the read-only line | jest render tests |
| E20 | B3, B4 | Brand app: the line on each Set posts row; the block on the brand's post stats; comments box → B5 | jest render tests |

## Regression gates
- `backend`: the full suite, serial, compared with `backend/baseline_youtube_shorts_only.json` (25 Oct) — 0 newly failing.
- `Packages/Mobile`: the existing suites for PostStats / PostStatus / BrandSetPosts (post-links-codes, post-performance-v2, item 20) stay green.
- Shopper app: not touched; its suites are not re-run.
