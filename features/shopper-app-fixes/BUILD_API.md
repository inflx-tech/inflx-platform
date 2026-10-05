# shopper-app-fixes — what the server sends and takes (for the phone builds)

Read `01-spec.md` first: F1–F15 and N1–N8 say what must be true afterwards. This file is the exact
agreement between the server (built in the same round, by the main session) and the phone.
All paths are under `/v1`. `followerApi` is in `Packages/Mobile/src/services/api.js`.

## Server changes the phone can rely on

### Checkout (F1)
- `POST /follower/checkout/place` — shape unchanged. For an ONLINE payment the bag is no longer
  emptied here (only when the payment arrives). Cash on delivery: emptied here, as now.
- `POST /follower/checkout/verify` — unchanged shape `{ checkout_id, status, already }`.
  `status` is `'placed'` or `'refunded'`. `'refunded'` = the payment arrived after the items had been
  released and they have sold out: nothing was ordered, the money is going back. The phone must NOT
  open "Order placed" for it.
- NEW `POST /follower/checkout/:id/abandon` (signed-in) → `200 { checkout_id, status }`.
  Releases the items held for an online payment that she cancelled or that failed. `status` is
  `'expired'` when it was released now or earlier, else what it already is (`'placed'`, `'refunded'`).
  Someone else's checkout → 404. Safe to call twice. Add `followerApi.abandonCheckout(id)`.

### Stock and size prices (F6, F10)
- Every post card (`feed`, stores, saved, search…): `products[].in_stock` is now `false` when every
  size has sold out. No shape change. A post whose products have all sold out no longer comes at all.
- `GET /follower/posts/:id/deal`: `products[].sold_out` (exists) and
  `products[].colours[].sizes[] = { size, price, shopper_price, left, sold_out }`.
  NEW `shopper_price` per size = what she pays for THAT size (equals `price` when no discount applies).
  The phone shows the chosen size's `shopper_price` (and `price` struck through when it is higher);
  before a size is chosen it shows the product's own `shopper_price` as now. `price_seen` sent with a
  bag line / Buy now is the chosen size's `price`. The phone never works a price out itself.

### Profile, names, following (F4, F13)
- `GET /follower/me/profile` → as now, plus `name_needed: boolean` (her name is still a placeholder).
  `rows.orders` now reads "2 on the way" / "3 orders" / "No orders yet"; `rows.following` reads
  "1 creator" / "4 creators". Show them as sent.
- `GET /followers/me` → `{ follower, addresses }` as now, plus `name_needed: boolean`.
- Sign-in: send NO `name` with `POST /auth/verify-otp` (it sent `name: 'Follower'`). After a
  successful verify, read `GET /followers/me`; when `name_needed` is true show the existing "Your
  name" step; save it with `PATCH /followers/me { name }` (already exists); then finish.
- Comments: an author who has given no name arrives as "INFLX shopper" (server side).
- `GET /follower/following` → `{ creators: [{ id, name, avatar, … }] }` (exists; a guest's follows go
  with the request the same way the feed sends them — see `whoParams()` in `shopStore.js`).

### Hearts in a collection (F14)
- `GET /follower/collections/:id`: each product now has `saved: boolean` (always `false` for a guest;
  a guest's hearts are on the phone as now).
- Remove a saved product: `DELETE /follower/saved/products/:productId` (exists,
  `followerApi.unsaveProduct`); a guest's is removed on the phone (`toggleSaveProductLocal(…, false)`).

### Notifications (F15)
- `GET /notifications` (signed-in) → `{ notifications: [{ id, type, title, body, data_json, is_read, created_at }], unread_count }`
  — the latest fifty, newest first. `POST /notifications/read-all` marks them read.
- What a shopper's notification carries (`data_json`, and the same in a push's additional data):
  `{ screen: 'order', line_id }` → open Order details for that line;
  `{ screen: 'orders', checkout_id }` → open My orders;
  anything else → open Profile › Notifications.
- Register the phone for push at sign-in: `POST /auth/onesignal-player-id { player_id }` with the id
  cached under AsyncStorage `inflx_onesignal_player_id` (App.js already caches it).

### Lists that go on (N5) — all exist on the server
- `GET /follower/creators/:id/posts?offset=N` and `GET /follower/brands/:id/posts?offset=N`
  (offer posts are brand posts with `offer=`) → `{ posts, more, next }` — send `next` as the next `offset`.
- `GET /follower/posts/:id/comments?before=<the 'at' of the oldest one shown>` → 30 older ones;
  `total` says how many there are.
- `GET /follower/orders?page=N` → `{ items, more }` (20 a page, page starts at 1).

### Titles (N7)
- A post with no caption is titled by its products on the server ("Blue polo and 2 more"); the phone
  shows `title` as sent.

## Rules for the phone builds
1. Shopper app only: `Packages/Mobile/src/screens/shop/**`, `screens/follower/**`,
   `components/shop/**`, `navigation/FollowerNavigator.js`, `services/api.js` (add calls; change the
   shared request code only for F3), `App.js` only for F15. Do not touch brand or creator screens.
2. Every sentence goes in `components/shop/copyShop.js` or `copyOrder.js` (or the screen's existing
   copy), in plain words said to the shopper. The exact words in `01-spec.md` are the words to use.
3. No new native module: this ships over the air to the builds of 30 Sep 2026.
4. A new screen = a new, unique route name registered ONCE in `FollowerNavigator.js`, with its import.
5. Prices, totals and counts shown are the server's. Never compute money on the phone.
6. A guest never sees "Session expired" or an error for something a guest may do.
7. Tests: add or extend jest tests beside each screen for every fault you fix (the existing
   `__tests__` folders show the style: the real screen rendered with the server's data shapes).
   NEVER skip, delete or weaken an existing test. A test that pinned the old (wrong) behaviour is
   moved to the new behaviour with a one-line note saying what changed and which fault (F/N id).
8. Do not run backend tests, do not start servers, do not use git to change anything, do not publish.
   Run `cd Packages/Mobile && npx jest <your files>` as you go and the whole phone suite at the end.
9. Another build is working in the same folders at the same time on other faults (see your brief for
   which files are yours). Edit with small exact replacements; never rewrite a whole shared file;
   re-read a shared file right before you edit it.
