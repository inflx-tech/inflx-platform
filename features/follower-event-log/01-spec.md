# 01 — Spec: follower-event-log (Slice 0 — Foundations)

**Program:** Follower posts/feed/stats program (chat session 2026-08-14).
**Slice:** 0 of 6 — "start writing things down".
**Class:** production-impacting (migration + `backend/src/**` + `Packages/Mobile/src/**`).

---

## 1. Problem, in one paragraph

The follower app has no memory. A follower can be shown forty posts, watch one
for twelve seconds, tap a product and leave — and nothing about that is
recorded anywhere. Today the only follower behaviour the database holds is
`post_likes` and `post_saves` (migration 141). There is **no record of what was
shown**, no views, no dwell, no taps, and **`follower_transactions` carries no
link back to the post that caused the sale** (verified: migrations 046, 050,
085, 094, 112 add product/variant/store attribution — none add a post).

Three downstream commitments are unbuildable until this exists:

1. **The feed algorithm** (slice 5) cannot rank on "what performs" or "what
   this follower likes" without a behaviour log, and cannot be tuned later
   against history that was never written.
2. **The dual-role rule** (slice 4, locked): own-store sales earn *no
   commission* but **sales per post must be shown to the creator**. With no
   post→order link that number cannot be produced at all.
3. **Every stats dashboard** (slice 6) counts events nobody is counting.

## 2. Goal

Record what followers see and do on posts, and link orders back to the post
that drove them. **Zero user-visible change.**

## 3. In scope

### 3.1 Schema (migration 150)

**`post_events`** — one append-only table for all post behaviour.

| column | type | note |
|---|---|---|
| `id` | uuid pk | |
| `post_id` | uuid → creator_posts, CASCADE | |
| `follower_id` | uuid → followers, CASCADE, NULL | NULL for guests |
| `device_id` | text NOT NULL | stable per install; the guest identity |
| `session_id` | text | groups one app session |
| `event_type` | text CHECK | see 3.2 |
| `surface` | text CHECK | where it happened — see 3.3 |
| `position` | integer NULL | rank in the feed when shown (impressions) |
| `product_id` | uuid → brand_products, NULL | for product taps |
| `dwell_ms` | integer NULL | for `view` |
| `meta` | jsonb NOT NULL DEFAULT '{}' | forward room; never load-bearing |
| `created_at` | timestamptz DEFAULT now() | |

Indexes: `(post_id, event_type, created_at DESC)`, `(follower_id, created_at
DESC) WHERE follower_id IS NOT NULL`, `(device_id, created_at DESC)`,
`(created_at DESC)`.

**`follower_transactions.via_post_id`** — nullable uuid → `creator_posts`,
`ON DELETE SET NULL`, plus a partial index. Additive, every existing row stays
NULL, no behaviour change (same pattern as `via_store_influencer_id`, mig 094).

### 3.2 Event vocabulary (locked at v1)

`impression` (post entered the viewport) · `view` (opened/played, carries
`dwell_ms`) · `complete` (video watched to end) · `tap_shop` (Shop this
post/video) · `tap_product` (a specific product tapped) · `share` · `save` ·
`unsave` · `like` · `unlike` · `add_to_bag`.

`save`/`like` remain **owned by** `post_saves`/`post_likes` for state; the event
row is the *timestamped record that it happened*, for the feed. Both are
written — state table and event log serve different jobs.

### 3.3 Surfaces

`discover` · `posts_tab` · `videos_tab` · `concept` · `creator_store` ·
`wishlist` · `search` · `share_link`.

### 3.4 API

**`POST /v1/follower/events`** — `authenticateOptional` (guests must be able to
log; guest-first is locked).

- Body: `{ device_id, session_id, events: [...] }`, **batch only**, max **100**
  events per call. One HTTP call per impression is not acceptable.
- Unknown `event_type`/`surface` → `VALIDATION_ERROR` (422). Not silently
  dropped — a typo must be loud in development.
- Unknown `post_id` rows are skipped, not fatal; response reports
  `{ accepted, skipped }`.
- Response: `{ accepted: n, skipped: n }`.

### 3.5 Order → post linkage

The cart already builds a **per-line claim** (`buildClaim`,
`services/CartContext.js`) from the `tracking` carried by a creator-driven add.
`post_id` rides there:

1. `ShopThisPostSheet` / `PostProductScreen` pass `post_id` when adding to bag.
2. `buildClaim` carries it on the line.
3. `ReviewOrderScreen`'s order payload sends it per item **and** at group level.
4. The transaction controller writes `via_post_id` on `follower_transactions`
   (the primary attributed line, matching the existing `product_id`
   convention, mig 046) **and** stamps `post_id` into each entry of
   `follower_orders.items_json`, so a multi-post cart keeps per-item truth.

### 3.6 Mobile plumbing

- `device_id` — uuid generated once, persisted in AsyncStorage.
- `session_id` — uuid per app foreground.
- An event queue service: buffer in memory, flush on **20 events**, **10
  seconds**, or **app background**, whichever first. Fire-and-forget; a failed
  flush drops the batch and never blocks or alerts the user.
- Wiring points: `PostsFeedScreen` (impression on viewability),
  `PostViewerScreen` (view/dwell/complete), `ShopThisPostSheet` +
  `PostProductScreen` (tap_shop/tap_product/add_to_bag).

## 4. Out of scope (explicitly)

Ranking/scoring of any kind (slice 5) · admin weight controls · any dashboard
or stats screen (slice 6) · daily rollup tables (add when volume demands it,
not before) · retention/purge policy (revisit at real volume) · social-media
scraping (slice 6).

## 5. Expected end state

A follower — signed in or guest — browses posts and buys from one; the database
then holds the impressions, the view with dwell, the product tap, and a
`follower_transactions` row whose `via_post_id` names the post that caused it.
Nothing in the app looks different.

## 6. Risks

- **Volume.** Impressions dominate. Batching + append-only + no triggers keeps
  writes cheap. No rollups yet — deliberate; revisit at real traffic.
- **Guest identity.** `device_id` is per install: reinstall = new identity.
  Accepted, documented, not solved here.
- **Silent no-op.** If the queue never flushes, everything downstream looks
  fine while nothing is recorded. Verification MUST assert rows landing in the
  database, not that the code was called.
