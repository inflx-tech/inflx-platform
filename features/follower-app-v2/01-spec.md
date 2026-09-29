# follower-app-v2 — the shopper app (spec)

**Source of truth:** `Docs/OFFER_TERMS_POSTS_RULES.md` v1.7 §5 (and §4.7, §4.12–4.15, M1–M6).
**Board:** `04-preview/mockups/follower-app-v2-mockups-v1.html`, F1–F13, locked by the founder on 29 Sep 2026.
**Decisions of 29 Sep** (founder, in chat): delete the old shopper code, keeping orders, payments, addresses
and returns, and keeping the old tables · no Add and no bag until checkout · Discover shows "Coming soon" ·
video from INFLX storage at launch, Cloudflare Stream later · engagement: the shopper side now · location =
the phone's current location, used and never stored, city as the fallback · the feed: Stage A on, Stage B
built and switched off behind an admin switch, readiness panel and preview · the board is locked.

## D1 · What a shopper sees is only live posts (P1)
Live = a v2 post, approved (has its code), posting date reached, not removed, its offer published and not
past its end, and at least one product on sale and in stock. Everything a shopper sees (feed, stores,
search, Saved, collections) is built from this pool.

## D2 · The feed (5.12)
- **Stage A (on):** followed creators → near her → everything else, newest first ("newest" = when the
  post went live: the later of its posting date and its approval). A style she picked lifts a post by one day.
- **Stage B (built, off):** score = weighted sum of four dials (what she does, how recent, how near, how it
  performs), weights from Platform settings. Her actions fade by half every 14 days; freshness by half every
  3 days; near = 1 within the range, range ÷ distance beyond it; performance = smoothed rate refreshed hourly
  (`post_performance`).
- **Fixed rules, either way:** never the same creator twice in a row (checked against the last post the phone
  showed) · a share of places (default 15%) for posts live under 48 hours from creators she doesn't follow ·
  never repeat a post seen in the last N days (default 30); when all are seen, seen posts come back, the one
  seen longest ago first, flagged `again` ("You're all caught up").
- **Session:** the phone sends the ids it has shown this session (`served`); the server keeps no session.
- **Play** is the same with videos only. A video tapped elsewhere goes first (`start`).
- **Opened photo:** that creator's posts, then same brand or category, then the rest (`/posts/:id/more`).
- **Her Women/Men/Kids choice** filters by the post's category segment (Unisex always passes).

## D3 · Where she is (5.3)
The phone sends `lat`/`lng` (rounded to ~100 m) with a feed or circles request, or her `city_id` when location
is off. The server uses it and stores nothing; migration 197 clears any coordinates the old app stored.
Near = a creator's city centre or any of the brand's store branches within `feed_near_km` (default 50).

## D4 · Circles (5.5)
Creators: followed → engaged (liked, saved, watched, shopped, opened) → near → the rest by INFLX followers.
Brands: bought from or visited → near → by live posts. Only those with live posts. Ring = a post live since
her last Home visit (the phone sends `since`); ringed first.

## D5 · A post for a shopper (F2–F5)
Creator, brand (with city), media, the offer's badge ("20% OFF", "ANY 2 FOR ₹2,999", "BUY 1 GET 1"…), the
applied line, each product at the price after the offer (discounts) with the old price struck, gift line on a
free-gift post, counts (likes, visible comments, shares, saves), and — signed in — whether she liked or saved
it and which of its products she saved. Never who bought, never sales or commission.

## D6 · Engagement (4.15, shopper half)
Likes and comments need sign-in; saves and follows work for guests on the phone. Comments: text, 1–300
characters, newest first; any shopper may report someone else's comment once; admin removes it (hidden from
the post) or keeps it (reports closed). `author_kind`/`reply_to` are in place for the creator's replies (Level 5).
Shares are recorded as events.

## D7 · Saved (5.8)
A saved product remembers its post (`follower_wishlist_items.post_id`) or its collection item. It must come
from one (P1). Available → price after that post's offer and "From Priya's post · 20% off till 31 Oct"; gone →
"No longer available with this offer. Divya's post ended on 15 Oct." and the other live posts carrying it.

## D8 · Guests and sign-in (5.2, 5.14)
A guest is known by the phone's anonymous id (`x-device-id` on every request). At sign-in the phone sends its
follows and saves (`/me/merge`), and her guest events are attached to her account. Safe to repeat.

## D9 · Stores, offers, collections (5.9, 5.10, 4.11, M6)
Creator store by id or handle (an old handle still works): details, INFLX followers, Follow, brands of her live
posts, categories of her live posts, Posts / Videos / Collections (hidden collections not listed). Brand
store: line, categories, creators, posts (filter by category, creator, offer); Offers: offer types, price
band, category, theme; only offers a live post carries, with post and creator counts. A collection's product
sells with its collaboration's running offer.

## D10 · Search and codes (5.11, 4.14)
A 6-character code (any case) → exactly that post, counted as a "Post code" visit; a post link opened in the
app passes its channel ending instead. Otherwise creators, brands and posts with live posts, by name,
caption, brand or product name.

## D11 · Welcome and Profile (5.4, 5.1)
Welcome: Women/Men/Kids, the eight styles on the board, "Use my location" or "Pick my city" from the offered
cities; skippable; kept on the phone and on her account. Profile: orders on the way, following, city, what she
shops for, video sound, policies, Returns · Addresses greyed. No wallet.

## D12 · Video (4.7)
Media stays on INFLX storage. The shopper app shows a video's product photo with "Update INFLX to play videos"
until the Play Store build brings the player, on-phone compression and in-app link opening for /c/. The
feed, actions and recording already work for videos.

## D13 · Admin
Comment reports (approvals capability), Feed readiness + preview (settings capability), the feed's nine
numbers on Platform settings. Follower App settings (video autoplay/sound, COD) kept.

## D14 · Removed with the old shopper app
Server: the section engine and App Builder, world rules, custom pages, concepts and admin collections,
Discover layouts, the campaign-era feeds and deals, public /store, /business, /category pages, v1 post
feed/like/save, food and restaurant search, saved offers, the product-only wishlist, coupon lookup, stored
location, the shopper wallet reads, the v1 post-eligibility job. Admin: 7 pages. Phone: every old shopper
component, the cart and food-order contexts, the location provider (which asked all three apps for location).
Kept: orders, payments (Razorpay, COD), addresses, returns, reviews, the product-variant and add-on brand
side, `follower.service` helpers still used by brand and creator screens. **No table is dropped.**
