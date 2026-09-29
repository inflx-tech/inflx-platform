# shoppable-posts-v2 — impact

**Production-impacting.** Migration 195, backend (Render), brand website (Vercel: the admin Posts page),
creator phone app (OTA: influencer). Explicit go required before migrate, push, OTA.

## What changes for people
- **Creators (phone):** the Create tab stops being "coming soon". Creators with a signed Pay for Sale or
  Hybrid collaboration on the new terms, whose shoot is done, can make shoppable posts (offer or price
  posts), follow them through review, fix sent-back posts, take posts down, and make collections. Today no
  production collaboration qualifies (all 22 are on the old terms), so the tab shows "Posting opens after
  both signatures and your shoot plan" until one does.
- **INFLX admin (website):** the Posts queue shows what a new post is for; approving re-checks it; the
  buttons read "Send back"; a "Left the shop" tab.
- **Brands (website):** the offer page counts real posts; ending an offer or removing products takes posts
  out of the shop. No new brand screens.
- **Shoppers:** nothing yet — new posts are kept out of the old follower feed and discover until the shopper
  app (rules §5).

## Retired
The July composer (`/me/post-scope`, `/me/posts/picker`, `/me/posts/upload-url`, `POST /me/posts`) answers
410 "The old post composer is retired". No app build calls it (profile-only since 10 Sep).

## Money
None moves. Sales through new posts can't happen until the shopper app; rows say "No sales yet".

## Data
Migration 195 (additive): tables `price_bands` (5 rows) and `theme_tags` (27 rows), `creator_collections`,
`creator_collection_items`; 16 columns on `creator_posts`, 3 on `post_media`; the status check gains
`removed`; the old "concept or collection" check now spares new posts. `scripts/run-195.js` prints posts
and money before/after and fails on any change to old posts or money.

## Risk
- A new daily job (00:10 IST) — idempotent, never throws.
- Product-edit and offer-end hooks now also touch posts; each is non-fatal.
- The admin page change is small; approval of old posts behaves as before.
