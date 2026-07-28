# backend-post-engagement — creator post engagement rollup

## Problem

The influencer Create tab lists each post as "N slides · M products". It
cannot say whether anyone *engaged* with the post. Creators have no signal
about which of their posts landed, so the Create tab reads as a filing
cabinet rather than a performance surface.

## What exists (verified, not assumed)

`backend/migrations/141_post_globals.sql` already creates:

- `post_likes (post_id → creator_posts, follower_id → followers, created_at)`
- `post_saves (post_id → creator_posts, follower_id → followers, created_at)`

Both are already written to by the follower app. **The engagement data is
already being collected — it was simply never read back on the creator side.**

## What does NOT exist (verified — this bounds the scope)

- **No view/impression counter anywhere.** Grepped `view_count|views|impression`
  across `140_creator_posts.sql` and `141_post_globals.sql`: zero matches.
  A views metric is not a migration, it is a new capture path (a write on
  every post render, with the volume/debounce/dedup design that implies).
  **Explicitly out of scope here.** Not stubbed, not faked, not shown as 0.
- **No `post_id` on `follower_transactions`** — so "sales from this post"
  cannot be answered. Separate contract (backend batch item 5).

## Scope

Extend `listMyPosts` so each post carries `like_count` and `save_count`,
computed from the tables that already hold the data.

## Non-goals

Views. Sales attribution. Any UI change (the Create-tab render is a separate
contract, deliberately kept out so this cannot regress the founder's E2E pass).
