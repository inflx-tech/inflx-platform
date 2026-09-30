# shopper-ordering — bag, deals, checkout, orders, cancelling (spec)

Rules: `Docs/OFFER_TERMS_POSTS_RULES.md` §6 (v1.12) and §1 (offers). Screens (LOCKED 30 Sep 2026):
`04-preview/mockups/shopper-ordering-mockups-final.html`: O1, O2, D1, P1–P3, B1–B4, V1–V4, K1–K5, G1–G5, D4,
D11, O6–O17. Survey of today's checkout: 30 Sep 2026 (in `lock.json` notes and `05-impact.md`).

The old follower checkout prices with the retired offer engine, never touches stock, and cancelling moves no money.
It is replaced, not patched. Pay at store, store-offer pay and prebook (same controller) are untouched (6.15).

## S1 · The price engine (R5, 6.4, 6.13): one function, used everywhere
`services/orderPricing.service.js` · `priceGroup(post, lines, now)` for one post group, `priceBag(groups)` for all.
- A **group** = the ticked lines of one post. The post fixes the brand, the creator's collaboration
  (`creator_posts.campaign_influencer_id` → `commission_pct`), and its offer (`creator_posts.offer_id`, engine 2,
  must be live that day and still linked in `collab_offers`). A post that is no longer live → the group can't be
  bought ("No longer available with this offer").
- Normal unit price = the colour/size price in `variants_json`, else `brand_products.price`.
- By sub-type (6.4): **percentage/flat** each unit (a % stops at its max ₹ per unit); **bogo** every paid unit may take
  one free unit of the same product up to `max_free`; the free unit costs ₹0; **quantity/value** the highest tier
  reached, % off every unit or ₹ off the group once; **pick_any/mix_match** full sets of N at the bundle price,
  costliest units first, leftovers at normal price; **fixed** only whole sets; **spend/buy_x** gift(s) once per order
  when the normal-price total (or unit count) of buy-pool lines reaches the minimum.
- Only products in the offer's buy pool (`offer_pool_items` pool `buy`, not removed) earn the deal; other products of
  the post pay their normal price.
- **Rounding:** a % per unit, to the rupee. Shared prices (bundle set, BOGO pair, volume ₹, and any group-level
  amount) are split in proportion to normal price, rounded, leftover rupee on the costliest line (6.13).
- Output per line: `normal_unit`, `paid_total`, `role` (buy / free / gift), `deal_key` (which set or pair it belongs
  to), and per group: normal total, savings, paid total, progress + the next nudge text, gift state
  (locked / choose / chosen / given-out), problems (price changed, sold out, offer ended, not sold).
- `offerRules.js` stays the source of each offer's config shape (`normaliseConfig`); `shopperPrice` keeps showing
  single-item prices and must agree with `priceGroup` for one unit (check C3).

## S2 · The deal page data (D1, P1–P3, B, V, K, G)
`GET /follower/posts/:id/deal` (guest or signed in): the offer (type, sub-type, config, deal line, how-it-works line,
ends on), every product of the post with photos, colours, sizes with stock (sold-out flagged, "only N left" at ≤3),
details, size chart, normal and discounted price, whether it is in the buy pool and which category (mix & match tabs,
fixed set order), and every gift (photo, name, worth, left = min(gift stock, limit − given), all given).
The app builds the deal locally; `POST /follower/deal/price` prices a proposed group with S1 (used for the sticky
bar and the review D4), so the phone never computes money.

## S3 · The bag (O6, O7, O8, D11)
- **Guests:** the bag is kept on the phone (`shopStore`, key `inflx_shop_v2`, field `bag`), priced by
  `POST /follower/bag/price` (no sign-in).
- **Signed in:** `follower_bag_items` (new): follower, post, product, colour, size, qty 1–5, role, deal_key,
  gift_item_id / pool item, ticked, price_seen, added_at. Routes `GET/PUT /follower/bag` (whole bag, replaced
  atomically, max 50 lines), `POST /follower/bag/price`. `/me/merge` (5.2) also moves the phone bag in.
- Same size of the same product from the same post adds quantity (max 5). Deal lines stay grouped by `deal_key`.
- `price_seen` lets the bag show "Price changed from ₹…" (O7).

## S4 · Addresses (O9, O10, 6.7)
Existing `follower_addresses`, extended: `house`, `area`, `state`, `label` Home/Work/Other; receiver name/phone,
landmark as today; **max 10** live addresses; update handler learns every field; 10-digit phone, 6-digit pincode,
state from a fixed list. Orders store a **snapshot** of the address (deleting never changes a past order).

## S5 · Checkout (O11, O12, 6.8)
1. `POST /follower/checkout/review` { address_id, lines } → S1 per group, parcels per brand with "Arrives by"
   (existing `computeEtaDate`), price details, COD allowed (≤ `cod_max_amount`, default ₹5,000) and its fee,
   delivery fee (setting, off), and every change since the bag.
2. `POST /follower/checkout/place` { address_id, lines, payment_method, expected_total } → re-prices; if the total
   differs from `expected_total` → 409 with the new review (nothing taken). Otherwise in one DB transaction:
   takes stock (S7) and gifts, writes a `checkouts` row (new: follower, address snapshot, amounts, method, status
   `pending`, `expires_at` = now + 15 min, the priced lines). **COD** → writes the orders at once (S6), status `placed`.
   **Online** → creates the Razorpay order, returns its id.
3. `POST /follower/checkout/verify` { checkout_id, razorpay_* } → signature check → writes the orders (S6).
   Also written by the Razorpay webhook `payment.captured` when the app died after paying (idempotent on the
   checkout). A payment arriving after the hold expired: orders written if stock is still there, otherwise refunded
   automatically (S8) and the checkout marked `refunded`.
4. `jobs/checkout-expiry.job.js` (every 5 min): pending checkouts past `expires_at` → `expired`, stock and gifts back.

## S6 · What an order writes (6.13, R4)
Per checkout, per brand a **parcel** = one `follower_orders` row (status, courier, tracking, ETA, address snapshot,
`checkout_id`); per post group one **`follower_transactions`** row (its creator's `campaign_influencer_id`, the
offer, `via_post_id`, `link_channel` from `channelForOrder`, gross/discount/net, commission, INFLX fee, brand net,
return window, `order_id` → the parcel); per item one **`order_lines`** row (new: parcel, transaction, post, product
or gift, colour, size, qty, role, deal_key, normal and paid amounts, commission, fee, brand net, status
active/cancelled, cancel reason/by/at, refund amount/id/status).
- **The three-way split (6.13, founder 30 Sep):** per line, at Place order, frozen on the line with its rates:
  creator's share = the collaboration's `commission_pct` × paid share; INFLX's share = `pricing.feeRateForPostSale`
  (the brand's own rate, else its category's Path B "via influencer", else the legacy brand rate) × paid share;
  brand = the rest. Worked in paise, the three always add up to the paid share (DB check `line_split_adds_up`);
  gifts and free units are ₹0 in all three. The creator's pending earnings are credited per transaction
  (`creditInfluencerCommission`, ledger ref = the transaction).
- **Cash on delivery (6.13):** the brand's courier holds the cash, so at settlement nothing is transferred; the brand
  owes creator's + INFLX's shares (+ TCS when on) of what it kept → a `brand_dues` row (source `order`), taken
  oldest-first, whole dues only, from its next online sales payouts (`settled_by_transaction_id`). The transfer
  retry never pays a COD sale and subtracts dues a payout already settled. Wallet credits never settle order dues.
- Keeping one transaction per post (one creator, one offer) means commission-confirm and the return claw-back run
  unchanged; commerce settlement changes only for cash on delivery and dues (above), and works GST on INFLX's share
  net of cancelled items (`platform_fee_reversed`).
- Notifications (6.9): shopper order placed; brand new order; creator "A sale through your post" (never who).

## S7 · Stock (R6)
Stock lives in `brand_products.variants_json` colours[].sizes[].stock (null = not tracked, never blocks).
`services/stock.service.js` takes and returns stock inside the caller's transaction with the product row locked.
Gifts: `gift_items.stock` (when tracked) and `offer_pool_items.gifts_given` against `gift_limit`. When every gift of
an offer's pool is gone, the offer's posts leave the shop (6.4, 4.9): the live pool query excludes them.

## S8 · Cancelling (O16, O17, 6.12)
`POST /follower/orders/lines/:id/cancel` { reason, note } — until the parcel is Shipped. Cancels the line's whole
deal (`deal_key`), and a gift whose threshold is no longer met. In one DB transaction: lines → cancelled, stock and
gifts back, the transaction's `commission_reversed` and `brand_net_reversed` grow by the cancelled lines' amounts
and the creator's pending earnings go down (the return claw-back pattern, ledger `cancel_clawback`); a transaction
with nothing left → `status='refunded'`, `brand_settlement_status='reversed'`; a parcel with nothing left →
`cancelled`. Then, outside the transaction, **online** → Razorpay refund of the paid share (plus the parcel's
delivery fee if the whole parcel went); COD → nothing to refund.
- The **brand** cancels a line the same way with a reason (`PATCH /brands/me/orders/lines/:id/cancel`).
- Brand/admin status changes move forward only (Confirmed → Packed → Shipped → Out for delivery → Delivered); Shipped
  needs courier and tracking; setting "cancelled" through the status route is replaced by the line cancel.

## S9 · My orders (O13–O15)
`GET /follower/orders` (lines newest first; filters status, time; search by product/brand), `GET
/follower/orders/lines/:id` (timeline with dates, courier, tracking, address snapshot, price paid, method, the post,
refund state), `GET /follower/checkouts/:id` (Order placed screen).

## S10 · Brand and admin
- Brand website `dashboard/fulfillment`: parcels with their items (size, the post and creator each came from,
  address), mark Packed / Shipped (courier, tracking) / Out for delivery / Delivered, cancel an item with a reason.
  Existing page adapted; no new design (6.14).
- Admin: `admin/orders` shows parcels and their money; `admin/app-settings` gains COD limit, COD fee, delivery fee
  and its free-above amount.

## S11 · Phone (follower flavour)
Screens exactly as the locked board: O1 size sheet, O2 Add on Shop this post + the bag icon with count in the top
bar, D1, the deal page per type (P/B/V/K/G) with the product pop-up, D4 review, bag O6/O7 with D11 groups, O8
sign-in at Continue, O9/O10 addresses, O11/O12 review and pay (Razorpay checkout SDK already in the app;
**no mock fallback in the shopper flow**), O13 placed, O14/O15 orders, O16/O17 cancel. Profile's greyed
"Addresses" and "Orders" entries come alive.

## S12 · Retired (with the pathway)
`POST /follower/orders`, `/follower/orders/verify`, `POST /follower/cart/price`, old `GET /follower/orders(/:id)`,
old `/follower/orders/:id/cancel`, `offerResolution` use in follower checkout, the old `previewCartOffer`
(unrouted; their controller code is left for a clean-up follow-up). Their tests go with them (`online-order`, `food-store-offer-checkout`, the checkout half of
`food-customisation`); the guard in `offers-v2-flow.test.js:435` still
holds (it checks only the old checkout's files; the new checkout lives in orderPricing / shopperCheckout and reads the pool
by design). No production order uses them (0 `follower_orders` on 30 Sep).

## Not in this step (6.15)
Returns and exchanges · pay at store · Shiprocket · invoices · pay-now nudge for COD · map addresses · a creator
"sales" screen (the creator is told by notification; her sales list comes with the creator screens).
