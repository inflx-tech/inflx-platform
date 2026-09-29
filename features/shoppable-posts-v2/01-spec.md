# shoppable-posts-v2 — spec (Level 3: a creator makes a shoppable post)

Rules of record: `Docs/OFFER_TERMS_POSTS_RULES.md` **v1.4, §4.1–4.11** (with §0 principles, §2 for
what she can sell, §3 M6 for collections). Locked screens: `04-preview/mockups/shoppable-posts-v2-mockups-v1.html`,
creator app **P1–P20**. Depends on `features/offer-builder-v2` (Level 1) and `features/creator-terms-v2`
(Level 2), both live.

## What Level 3 delivers

In the creator app's **Create** tab (today a "coming soon" page), a creator with a signed Pay for Sale or
Hybrid collaboration makes **shoppable posts**: brand → collaboration → offer post or price post →
products → theme tags → photos or video → caption and review → sent to INFLX. INFLX approves or sends
back. She sees her posts by state (live, in review, sent back, removed, drafts), fixes a sent-back post,
takes a post down, and makes **collections** of her posts or products.

## The board's five questions (founder, 29 Sep: "Given all mockups and rules doc … start implementation")

| Q | Decision (the board's recommendation) |
|---|---|
| Q1 | No edits once a post is approved. She can take a post down herself: it leaves the shop and keeps its earnings history. |
| Q2 | When sent back she can change media, caption, products and theme tags — not brand, collaboration, post type or offer (for those, a new post). |
| Q3 | Up to 10 slides and 30 products per post; a video clip up to 90 seconds. |
| Q4 | Product tags on photos are optional; every picked product is in the post's product list anyway. |
| Q5 | Collections: rename, add or remove items, delete any time; posts-only or products-only; hidden from shoppers when nothing in it is in the shop; deleting never touches her posts. |

## What exists today (survey 29 Sep) and what Level 3 does with it

| Exists | Level 3 |
|---|---|
| `creator_posts` + `post_media` + `post_products` (pins x/y), mig 140 — the July composer: scope single/multi/all, concept or admin collection, images only, created straight as `submitted` | **Extended**, not replaced: a `v2` flag and the new columns. Old rows untouched. |
| Old composer endpoints (`/me/post-scope`, `/me/posts/picker`, `POST /me/posts`) | **Retired** (410 with a plain message): multi-brand and "everything" posts are gone (4.8). No app calls them (apps are profile-only since 10 Sep). |
| Admin queue `/v1/admin/posts` + website page `admin/posts` (approve / send back) | **Kept and extended** for new posts: collaboration, post type, offer, facets. Approval re-checks the post. |
| 27 theme tags as concept templates; 9 overlapping price templates | **New tables**: `theme_tags` (27, four groups) and `price_bands` (the five). The concept tables are left for the old readers; concepts are retired by the rules (4.12) and removed with the shopper app. |
| Image presign (R2, 15 min) | **Kept** for photos; videos use item 12's signed-length upload (the size is locked in the signature). |
| Follower feed, discover, eligibility sweep read `creator_posts` | **Exclude new posts** until the shopper app shows them (rules §5, later). |
| `min_shoppable_posts` stamped on the collaboration; nothing counted it | **Counted**: approved posts in the collaboration by the posting date (4.10). |
| Nothing: drafts, resubmit, video, post↔collaboration/offer link, price bands, theme tags per post, creator collections, "removed" posts | **Built.** |

## Decisions taken in building (founder delegated; recorded here, surfaced in the build summary)

| # | Decision | Why |
|---|---|---|
| D1 | New posts are rows of `creator_posts` with `v2 = true`, `campaign_influencer_id`, `brand_id`, `post_kind` (offer / price), `offer_id`. The old "concept or collection" check applies only to old rows. | One table keeps `via_post_id` on sales and the media route working. |
| D2 | **Who can post (4.1, founder rules O1 still open):** a collaboration that is Pay for Sale or Hybrid, on the new terms, **signed by both**, and whose **shoot is done** (`production_events.status = 'completed'`, the same test the content step uses). One function; it changes when the shoot-plan rules arrive. A brand with no such collaboration yet shows "Opens after your shoot plan". | P2; the board's interim rule. |
| D3 | States: **draft → in review (`submitted`) → approved → live** from the posting date (worked out from the date, never stored) · **sent back** (`rejected`) → fixed → in review again · **removed** (final). Removed has a reason: offer ended, products removed, unavailable, sold out, taken down. | P12–P15; a removed post can't come back (its media promised a deal that's gone). |
| D4 | **Drafts**: created when she picks the collaboration; every step saves. The draft remembers its step. A draft can be deleted. | 4.2 "saved automatically at every step". |
| D5 | **Offer post**: offer types she has in this collaboration, with counts (empty types hidden) → one offer (running, linked, not ended) → products from its live buy pool: Discount/BOGO/Volume at least 1; pick-any / mix & match at least the pick count; fixed bundle adds every product by itself; free gift picks from the buy pool and the gift shows by itself. | 4.2, 4.3; P5–P7. |
| D6 | **Price post**: only her products without offers that are still on sale; a price band and categories only filter the list; at least 1 product. | 4.2; P8. |
| D7 | **Facets** worked out by the server: category = every leaf its products are in; offer = type + deal; price band = the band of the highest price one item costs (discount → the discounted price; BOGO, volume, bundle, free gift and price posts → the normal price). Recomputed when products or prices change. | 4.6; P11. |
| D8 | **Price bands**: five rows (Under ₹499 · Under ₹999 · Under ₹1,999 · Under ₹2,999 · ₹3,000+), "under" meaning up to and including. An admin screen to edit them comes later; the table is the source. | 4.4. |
| D9 | **Theme tags**: 27 tags, four groups (Season, Occasion, Style, Use); at least 1, at most 1 per group; fixed once approved. | 4.5; P9. |
| D10 | **Media**: photos (JPEG/PNG/WebP, up to 10 MB) or video (MP4, up to 200 MB, up to 90 s per clip); single or carousel up to 10; one kind per post. The music warning at upload. **Streaming (Cloudflare)** comes with the shopper feed — the only place that plays posts; Level 3 stores videos like item 12. | 4.7; Q3; P10. |
| D11 | **Pins** optional, photos only (Q4); every picked product is in the post either way. | P11a. |
| D12 | **Sent back** (Q2): media, caption, products, theme tags can change, then "Fix and send again". "Start over" opens a new draft for the same collaboration; the sent-back post can be deleted. | P13. |
| D13 | **Take down** (Q1): an approved post (before or after its posting date) → removed, reason "taken down". | Q1. |
| D14 | **Approval re-checks** the post: offer still running and linked, products still sellable, tags and media valid. A stale post is refused to the admin with the reason; sending back is always allowed. | Only what's still true goes live. |
| D15 | **A post's life (4.9)**: offer ended early or by date → removed (the end-now hook + a daily sweep, and reads treat a passed end date as removed); products removed from the offer or unavailable → they leave the post, an empty post is removed; every product sold out (stock 0 where stock is kept) → removed; a price change → the band recalculates. She is told when a post is removed; the notice opens the removed post (P15). | 4.9, 1.10, 2.8. |
| D16 | **Minimum posts (4.10)**: approved posts in the collaboration, approved on or before its posting date, against `min_shoppable_posts`. The Create tab lists collaborations still short, before their posting date. The brand-side flag comes with the brand's post screens. | P1. |
| D17 | **Collections (4.11, Q5)**: name + posts (her approved posts that are in the shop, any brand) or products (from her collaborations' sellable products, each remembering its collaboration). No approval. Hidden when nothing in it is in the shop. Rename, add, remove, delete. | P16–P20. |
| D18 | **Sales and earnings** on posts and collections are read from sales through the post (`follower_transactions.via_post_id`). None can happen until the shopper app, so rows say "No sales yet" instead of inventing numbers. | Backend-first tiles. |
| D19 | **Not in Level 3:** the shopper side (feed, post page, checkout applying the post's offer, stock going down — M7), post links and codes (Level 4), engagement and social numbers (Level 5), the brand's view of its posts and the missed-minimum flag, an admin screen for price bands. | Later levels. |
