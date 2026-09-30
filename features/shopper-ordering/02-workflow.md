# shopper-ordering — workflow

## W1 · A simple post (O1, O2)
Shop this post (F3) → **Add** on a product → size sheet (colour, size with stock, size chart) → **Add to bag**
(bag icon count +1, "✓ In your bag · S") or **Buy now** (straight to O11 with that one item; the bag is untouched).

## W2 · A deal post opens its deal page (D1, P1–P3)
Shop this post → offer card, how it works, product/gift counts → **Build your deal** (or Add on any product: the
deal page opens with that product's pop-up). Tap a product → pop-up (photos, price and what it does in the deal,
colours, sizes with stock, size chart, details, quantity where the deal allows) → **Pick** → closes → card shows
"✓ Picked · colour · size" → sticky bar re-priced by `/follower/deal/price` → next product. Tap a picked card →
change or **Remove**.

## W3 · Per deal
- **BOGO (B1–B4):** product → pop-up part 1 (paid: colour, size) → **Next: your free one** → part 2 (same product,
  any colour, size) → **Pick this pair** → pair listed with Change / Remove → another pair up to the max.
- **Volume (V1–V4):** ladder at the top; each pop-up says what the pick does and allows quantity; cards show the
  price after the tier and ×count; bar: "1 more → 30% off".
- **Bundle (K1–K5):** pick any / mix & match fill slots ("Put in set"); a full set shows "Set complete"; **Add another
  set** or **Review**; a pick outside a full set pays its normal price. Fixed: each item's pop-up → "✓ Chosen"; the
  button works when all are chosen.
- **Free gift (G1–G5):** step 1 buy with the progress to the minimum → step 2 unlocks: all gifts, each in its pop-up
  (a store product as a gift asks its size) → **Choose this gift**. Falling below the minimum locks step 2 and drops
  the gift. One gift in the pool is added by itself.

## W4 · Review and bag (D4, D11, O6, O7)
Every deal → **Review your deal** (items, gift, pays, saves; Change / Remove) → **Add to bag** or **Buy now**.
Bag: grouped by post; deal groups with **Edit deal** (reopens the deal page holding her picks); tick boxes; qty 1–5;
Change / Remove / Move to Saved; changed states shown (price changed, size sold out, offer ended, not sold) and those
items can't go on; price details; **Continue**.

## W5 · Sign-in, address, pay (O8–O12)
Guest → Continue → number → OTP → the phone bag merges into her account → checkout carries on.
Checkout opens on the default address (**Change** → O9 list, **Add new** → O10) → review (parcels per brand with
arrival dates, price details, changes shown first) → payment method (UPI / cards / net banking, or COD ≤ ₹5,000 with
its fee) → **Place order ₹X** → online: Razorpay sheet (15 minutes, items held) → verified → **Order placed** (O13).
A total changed at Place order → the new review, nothing taken. Payment abandoned → hold ends after 15 minutes.

## W6 · After the order (O13–O17)
Brand gets "New order"; each creator gets "A sale through your post". Brand website: Packed → Shipped (courier,
tracking) → Out for delivery → Delivered; shopper told at each. **My orders** → item → timeline; **Cancel** until
Shipped → reason (required) → warning if part of a deal / gift follows → Cancelled: stock back, commission taken
back, brand not paid for it; online refund to the original method ("5–7 working days"), COD nothing to refund.
Brand can cancel an item it can't send, with a reason; the shopper is refunded the same way.

## W7 · Money over time (unchanged jobs)
Commission waits in the creator's pending earnings; after the return window closes `commission-confirm` moves what
is left (commission − reversed) to her wallet; `commerce-settlement` pays the brand brand net − reversed − TCS.
A post group fully cancelled is `refunded` / `reversed` and never paid.

## W8 · INFLX admin
Orders page: parcels, lines, money. App settings: COD limit, COD fee, delivery fee (off) and free-above amount.
