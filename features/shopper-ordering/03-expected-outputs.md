# shopper-ordering — expected outputs: the checks

Each check is a test (backend `tests/shopper-ordering.test.js`, phone `__tests__/order17.test.js`) unless marked
**walk** (the founder's phone walk at the end, per the E2E-at-the-end rule).

## Price engine (S1)
- C1 Discount 20% on ₹1,200 → ₹960; a % with max ₹150 on ₹1,200 → ₹1,050; ₹ off 200 → ₹1,000.
- C2 Volume by quantity 20% / 30%: ₹999 + ₹1,199 → ₹799 + ₹959 = ₹1,758, save ₹440 (V1); third ₹1,799 → ₹1,259.
- C3 `shopperPrice` for one unit equals `priceGroup` for that one unit, for every sub-type.
- C4 Volume ₹: tees ₹699 ×2 + ₹899, "Buy 3 ₹400 off" → ₹1,897; the ₹400 shared by normal price, parts add to ₹400.
- C5 Volume by value: ₹1,650 + ₹800 = ₹2,450 → 10% → ₹2,205; nudge "Spend ₹550 more → 20% off".
- C6 Pick any "2 for ₹2,999": ₹2,299 + ₹1,999 → one set ₹2,999, save ₹1,299; a third ₹1,799 pays normal price with
  "Add 1 more to complete another set"; with 4 items the two costliest form the first set.
- C7 Mix & match counts across categories; a product outside the buy pool never fills a slot.
- C8 Fixed set ₹4,999 (₹6,297 normal) only whole; missing one item → the group can't go to checkout.
- C9 BOGO: 2 units of the same product → 1 paid, 1 free (₹0) even if the free variant costs more; capped at max free.
- C10 Gift spend ₹3,000: at ₹2,999 locked; at ₹3,250 choose 1; two gifts chosen when the offer gives 1 → rejected;
  buy X counts units; one gift in the pool is added by itself; gifts never priced, never commission.
- C11 Rounding: "2 for ₹2,999" on ₹2,000 + ₹1,500 → ₹1,714 + ₹1,285; every shared split adds up exactly.
- C12 A post not live, an offer ended, or a collaboration link dropped → group "No longer available with this offer".
- C13 A product not in the buy pool on a deal post pays its normal price.

## Deal page, bag (S2, S3)
- C14 `/posts/:id/deal` lists every product with colours, sizes, stock (sold-out flagged, "only N left" ≤3) and every
  gift with left = min(stock, limit − given); guest allowed; no buyer data.
- C15 Bag PUT replaces atomically; qty > 5 rejected; same post+product+colour+size merges; 51 lines rejected.
- C16 Price changed since `price_seen` → flagged with the old price; sold-out size → not checkout-able.
- C17 `/me/merge` moves a guest bag into the account without duplicates.

## Addresses (S4)
- C18 11th address rejected; bad phone / pincode / state rejected; update saves every field; delete keeps past order
  snapshots intact.

## Checkout (S5, S6, S7)
- C19 Review returns parcels per brand, ETA, price details; COD allowed at ₹5,000, refused at ₹5,001; fee added.
- C20 Place with a stale `expected_total` → 409 with the new review; no stock taken, no rows written.
- C21 COD place writes: 1 checkout, 1 `follower_orders` per brand, 1 `follower_transactions` per post group,
  1 `order_lines` per item; totals of lines = transaction = parcel = checkout.
- C22 Commission per line = pct × paid share; gift/free lines 0; creator pending earnings + ledger row once per
  transaction; INFLX fee and brand net per line add up to the transaction.
- C23 Stock goes down in `variants_json` for the ordered colour/size; untracked (null) never blocks; two shoppers
  racing for the last unit → one wins, the other gets "sold out" and nothing is written for her.
- C24 Gifts: `gifts_given` +1 and gift stock −1; last gift given → the offer's posts leave the live pool.
- C25 Online: place → pending checkout with Razorpay order, stock held; verify (bad signature → 400, nothing written;
  good → orders written once; second verify idempotent); webhook `payment.captured` writes the same orders once.
- C26 Expiry job: pending past 15 min → expired, stock and gifts back; a payment arriving later with stock gone →
  refund issued, checkout `refunded`.
- C27 `link_channel` recorded per transaction from `channelForOrder`; `via_post_id` = the post.

## Orders, cancelling (S8, S9)
- C28 Cancel refused once Shipped; reason required.
- C29 Cancelling one line of a set / pair / volume deal cancels the whole deal; a gift below threshold follows.
- C30 Cancel: stock back; `commission_reversed` and `brand_net_reversed` grow by exactly the cancelled lines;
  pending earnings down; ledger `cancel_clawback`; everything cancelled → transaction `refunded` / `reversed`,
  parcel `cancelled`.
- C31 Online cancel calls the refund for the paid share (plus delivery fee on whole parcel); COD → no refund call.
- C32 commission-confirm pays only commission − reversed; commerce-settlement pays brand net − reversed; a fully
  cancelled transaction is never paid (existing jobs, new rows).
- C33 Brand cancels a line with a reason → same effects, shopper notified.
- C34 Status moves forward only; Shipped needs courier + tracking; a brand can't touch another brand's parcel.
- C35 My orders lists lines newest first, filters work, detail shows the timeline, snapshot address, post, refund.

## Retired (S12)
- C36 Old `POST /follower/orders`, `/orders/verify`, `/cart/price` → 404; pay at store, store-offer pay and prebook
  still pass their tests.

## Phone
- C37 Screen names and navigation: every locked screen reachable; no duplicate Stack.Screen names; every screen used
  is imported (the native-crash rule).
- C38 The phone never computes money: totals shown come from the server responses.
- C39 **walk** the whole chain on a phone: simple Buy now, each deal type into the bag, guest sign-in at Continue,
  COD order, online order (Razorpay test), cancel one deal item, brand marks shipped on the website.
