# shopper-ordering — impact

**Production-impacting and money-moving.** Migration 198, backend (Render), brand website + admin (Vercel), phone app
(OTA: follower; brand/influencer untouched). Explicit go required before migrate, push, OTA. First step that takes real
shopper payments and issues refunds.

## What changes for people
- **Shoppers:** the shopper app can now buy: size sheet, a full deal page for each deal type with the product pop-up,
  bag, sign-in at Continue, addresses, Razorpay or cash on delivery, my orders, tracking, cancelling with automatic
  refunds. Profile's Addresses and Orders come alive.
- **Brands (website, Fulfilment):** orders arrive as parcels with their items, sizes and the post/creator each came
  from; they mark Packed / Shipped (courier + tracking now required) / Out for delivery / Delivered, and can cancel an
  item with a reason. Status can no longer go backwards or jump to "cancelled" without the cancel step.
- **Creators:** "A sale through your post" notification; commission lands in pending earnings as today and is taken
  back when an item is cancelled. No screen change.
- **INFLX admin:** Orders shows parcels and money per item; App settings gains COD limit (₹5,000), COD fee, delivery
  fee (off) and its free-above amount.

## Data (migration 198, additive)
New: `follower_bag_items`, `checkouts`, `order_lines` (with the three shares and the rule that they add up).
Added columns: `follower_orders.checkout_id / brand_id / address_snapshot / delivery_fee`,
`follower_transactions.order_id / checkout_id / platform_fee_reversed`, `follower_addresses.house / area / state`,
`brand_dues.settled_by_transaction_id`; ledger type `cancel_clawback`. Nothing dropped, nothing rewritten. Production on 30 Sep: 0 `follower_orders`, 0 addresses,
0 returns; 16 seeded `online_order` transactions (one follower, one brand, no payment ids, Jul–Aug) are left untouched.

## Money
- **Every rupee split three ways per item** (rules 6.13): creator's share at her collaboration %, INFLX's share at
  the admin rate (fashion Path B, 5% today), the brand the rest — frozen on the item, to the paisa. ₹1,000 →
  ₹100 / ₹50 / ₹850.
- One transaction per post group keeps one creator + one offer per money row, so **commission-confirm and the return
  claw-back run unchanged**; cancelling uses the claw-back's own columns.
- **Commerce settlement changes for cash on delivery**: no transfer (the brand has the cash); the brand owes the two
  shares as a due, taken from its next online payout. Settlement-retry skips cash-on-delivery sales.
- New money actions: **Razorpay refunds** (online cancels, late payments with stock gone) and the Razorpay
  `payment.captured` webhook for shopper checkouts (fixes: an app closed after paying left no order).
- Fixes carried by the rebuild: stock never went down; cancelling never refunded nor took commission back; a cancelled
  order could still be paid to the brand; checkout ignored the new offers so the app's price ≠ the charged price.

## Removed (the old follower checkout, S12)
`POST /follower/orders`, `/orders/verify`, `/cart/price`, the old order list/detail/cancel, `previewCartOffer`,
`offerResolution` in follower checkout (all unrouted). Tests of that pathway retire with it (online-order.test.js and
food-store-offer-checkout.test.js removed; food-customisation's checkout half removed). Nothing calls them
since the shopper app rebuild (29 Sep). Pay at store, store-offer pay, prebook: untouched.

## Not designed on the board (adapted, no new look)
Brand website Fulfilment: parcels with items, each item's three shares, per-item cancel with a reason. Admin Orders:
each parcel's money is the sum of its items (and the list, broken since migration 059 renamed the fee column, works
again). Admin Follower App settings: COD limit, COD fee, delivery fee, free-above; the COD switch shows what the
server does.

## Risk
Real payments and refunds: Razorpay keys must be live on Render (checked before deploy; the phone never fakes a
payment — a test-mode server's test orders are confirmed on a visible "Test payment" prompt). Stock taken at Place
order with a 15-minute hold; the expiry job (every 5 minutes) returns it. **Razorpay dashboard: the
`payment.captured` webhook event must be switched on** for the backstop that writes an order when the app closed
after paying.

## Not in this step (open)
Buying straight from a product collection (M6) — saves only, "open it from a creator's post". "Need help" on an
order — waits for INFLX's support contact. The old checkout's controller functions are unrouted (not deleted) —
a clean-up follow-up.
