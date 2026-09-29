# follower-app-v2 — impact

**Production-impacting.** Migration 197, backend (Render), website admin (Vercel), phone app (OTA: follower).
Explicit go required before migrate, push, OTA. The Play Store build (video player, on-phone compression,
`/c/` link opening) is a separate step with its own go.

## What changes for people
- **Shoppers (follower app):** the profile-only app becomes the shopper app: Home (circles + feed), Discover
  ("Coming soon"), Play, Saved, Profile, Search, stores, offers, collections, comments. Guests can browse,
  follow and save. Production has **no approved new post yet**, so the feed opens empty until the first one.
- **All three apps:** the old location provider that asked every app for location on first launch is gone;
  only the shopper app asks, at Welcome.
- **INFLX admin:** 7 old pages gone (Concepts, Collections, Discover Builder, App Builder, World Settings,
  Custom Pages, Category Images); new Comment reports and Feed pages; nine feed numbers on Platform settings.
- **Creators and brands:** nothing changes on their screens. Their posts' likes, comments, saves and shares
  start counting when shoppers use the app.

## Data (migration 197, additive + one clear)
`followers.city_id / shop_for / style_tag_ids / welcomed_at`; `follower_wishlist_items.post_id /
collection_item_id`; `post_comments`, `post_comment_reports`; the recording vocabulary on `post_events` widened;
`post_performance`; nine `platform_settings` rows (learning switch = 0). Clears `followers.last_lat / last_lng /
area_name / location_updated_at` (0 rows held in production on 29 Sep). No table dropped.

## Removed code (no data touched)
Old shopper routes, controllers and services (section engine, concepts, Discover layouts, deals, campaign feeds,
v1 post feed, food search, saved offers, product-only wishlist, coupon lookup, stored location, wallet reads,
v1 eligibility job); 7 admin pages; ~75 phone files. Old tables stay (drop later, separately).

## Privacy
No exact location stored anywhere. Guests are an anonymous phone id. Creators, brands and admin see totals,
never one person's viewing; the admin preview shows a feed's order, not her history.

## Money
None moves. No checkout in this change.

## Risk
- Old shared links `inflx.in/s/<handle>?cid…` still open the store (query ignored); `/b/`, `/o/` open nothing.
- Unknown `/follower/*` paths answer 401 to a guest (the checkout router is mounted there) — as before.
- Video: until the Play Store build, a video post shows its product photo and a note.
