# follower-app-v2 — workflow

## W1 · First open (F1)
Guest opens the app → Home → the optional Welcome (once): Women/Men/Kids, styles, "Use my location" (Android
asks) or "Pick my city" → kept on the phone (`inflx_shop_v2`) → Home.

## W2 · Home (F2)
`GET /follower/circles?since&shop_for&styles&city_id&lat&lng&follows` → two rows of circles.
`POST /follower/feed { mode:'home', served, shop_for, styles, city_id, lat, lng, follows }` → 12 posts; scrolling
asks again with the grown `served`. The phone records `impression` (half on screen, 1 s), `dwell`, taps.

## W3 · Shopping a post (F3)
Shop this post → the sheet: products at the offer price, ♡ per product → signed in `POST /follower/saved/products
{ product_id, post_id }`, guest → the phone. No Add until checkout.

## W4 · Opening (F4, F5)
Photo → Post screen + `GET /follower/posts/:id/more?served`. Video → Play tab with `start` →
`POST /follower/feed { mode:'play', start }`.

## W5 · Comments, likes (F6)
`GET /follower/posts/:id/comments` (anyone). Like / comment / report need sign-in (guest → sign-in sheet).
Admin → Comment reports → Remove / Keep (`/admin/shopper/comments/:id/decide`).

## W6 · Stores (F7–F10)
`/follower/creators/:idOrHandle` (+ `/posts?tab&category`, `/collections`), `/follower/collections/:idOrCode`,
`/follower/brands/:id` (+ `/posts?category&creator&offer`, `/offers?type&band&category&theme`), `/follower/filters`.

## W7 · Saved (F11)
Signed in `GET /follower/saved`; guest `POST /follower/saved/resolve { posts, products }`.

## W8 · Search (F12)
`GET /follower/search?q` — a code → `code_match` (state live / upcoming / gone / unknown), else creators, brands, posts.

## W9 · Links from outside
`inflx.in/p/<code>/<ch>` → Post screen → `GET /follower/code/<code>?ch=` (visit on that channel);
`/s/<handle>/<ch>` → `GET /links/s/…` (visit) + Creator store; `/c/<code>` → `GET /links/c/…` + Collection.

## W10 · Sign-in (F13)
Sign in → `POST /follower/me/merge { follows, saved_posts, saved_products }` with the device id → guest events
join her account → `PATCH /follower/me/preferences` with her Welcome choices.

## W11 · INFLX admin
Platform settings: the nine feed numbers (learning switch off). Feed page: readiness panel + preview by phone.
Hourly job `post-performance` (at :17). Switching learning on changes the next feed request; no app update.
