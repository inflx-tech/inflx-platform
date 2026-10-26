# post-engagement-stats — workflow (DRAFT 26 Oct 2026)

Step numbers are used by `03-expected-outputs.md`. "The system" column is the server unless said otherwise.

## A · Shoppers act (unchanged — recorded today)

| # | Who | Does | The system |
|---|---|---|---|
| 1 | Shopper (guest or account) | Opens Priya's post "Festive Sarees" from Home, taps Shop, taps a product, adds to bag, shares; watches the video to the end | the app batches `open, tap_shop, tap_product, add_to_bag, share, complete` to `POST /follower/events` — unchanged |
| 2 | Shopper (account) | Likes, saves, comments | rows in `post_likes`, `post_saves`, `post_comments` — unchanged |

## B · The creator reads her post's numbers

| # | Who | Does | The system |
|---|---|---|---|
| 3 | Creator | Opens Post status of a live post | `GET /influencers/me/shoppable-posts/:id` answers `inflx {views, likes, comments}`; the screen prints **"In INFLX · 1,840 views · 212 likes · 38 comments"** above the social line (C3) |
| 4 | Creator | Taps Stats | `GET …/:id/stats` answers `inflx {since, views, likes, comments, shares, saves, shop_taps, bag_adds, finished}`; the screen draws the **In INFLX** block between the money row and On social media (C4) |
| 5 | Creator | Reads the hint | "Shoppers inside INFLX since 10 Oct. Guests count for views, shares and taps; likes, comments and saves need an account." |
| 6 | Creator | Post nobody opened yet | the line reads "In INFLX · nothing yet"; the block shows zeros |

## C · The creator manages comments

| # | Who | Does | The system |
|---|---|---|---|
| 7 | Creator | Taps the comments box | `GET …/:id/comments` → C5: newest first, 30 a page, shoppers' comments with her replies under them, hidden ones greyed |
| 8 | Creator | Replies to a shopper's comment | `POST …/:id/comments { reply_to, body }` → a `post_comments` row `author_kind='creator'`; shoppers see it under the comment labelled as hers; the count does not change |
| 9 | Creator | Hides a comment | `POST /influencers/me/comments/:cid/hide` → `status='hidden'`; it leaves the shopper list and the count; she sees it greyed with Unhide |
| 10 | Creator | Unhides it | `POST …/unhide` → `status='visible'`; back for everyone |
| 11 | Creator | Tries to unhide a comment INFLX removed | refused, 409 "INFLX removed this comment"; it is not in her list anyway |
| 12 | Creator | Replies with an empty body or 301 characters | 422, the shopper app's own message words |
| 13 | Another creator | Calls any of these on her post | 404 |

## D · The brand reads

| # | Who | Does | The system |
|---|---|---|---|
| 14 | Brand | Opens Set posts | each row gains **"In INFLX · 1,840 views · 212 likes · 38 comments"** under the visits/orders line (B3) |
| 15 | Brand | Taps a post | `GET /campaigns/:id/sets/:sid/posts/:postId/stats` carries the same `inflx` block; the screen draws it between the money row and On social media (B4) |
| 16 | Brand | Taps the comments box | `GET …/posts/:postId/comments` → B5: visible comments and her replies, no buttons, "Only Priya can reply or hide" |
| 17 | Another brand | Calls either | 404 (the set is not its) |

## E · Own-brand post (item 20)

| # | Who | Does | The system |
|---|---|---|---|
| 18 | Creator who owns a brand | Opens the stats of his own-store post | the same block; money reads "sales" as today; he replies as the creator |

## Edges

- A comment by the creator is never counted and never hideable from C5 (there is no reason to hide one's own reply).
- A like then unlike: 0 likes. A save by a guest: counted once she signs in (the app merges it), not before.
- A post taken down: the numbers stay readable on Post stats for as long as the post's stats are (today: the screen is reachable only while live — unchanged).
- Nothing here reads or writes money, escrow, wallets or `follower_transactions`.
