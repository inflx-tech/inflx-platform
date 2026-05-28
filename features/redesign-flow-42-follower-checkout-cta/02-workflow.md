# Flow 42 (F3) — Workflow

**Actor**: Follower (sign-in required at pay).

## A · PayAtStoreScreen (unified pay — walk-in / known-amount / prebook-balance)
- Dispatches to `RestaurantBillScreen` when `category === 'restaurant'` (preserved).
- States: enter → processing → success(receipt).
- Renders: ink hero ("Pay at {store}" + "via {creator}'s deal") · yellowPale deal
  card (ink badge) · successPale token-banner (prebook balance) · ink-bordered
  amount input · bg2 breakdown (bill → successText discount → discounted total →
  token → mono "You Pay Now") · ink/yellow PAY {amount} VIA UPI · Razorpay note.
- Success: yellow-tile MCI check + Outfit-Black "Payment Successful!" + mono ref +
  bg2 receipt box + ink/yellow DONE.
- Pay flow (UNCHANGED): sign-in gate → `payAtStore({cid,sid,oid,iid,bill_amount,...})`
  → `processPayment({amount: youPay*100, orderId})` → `verifyPayAtStore` → receipt.
- Q3 discount math (UNCHANGED): discount = bill×pct; you_pay = (bill−discount)−token.

## B · OnlineOrderScreen (cart + address + place order)
- Cart items w/ qty steppers · delivery address radio (ink-active) · price summary
  · sticky footer mono total + ink/yellow PLACE ORDER.
- Place flow (UNCHANGED): `createOrder({items, delivery_address_id, offer_id,
  influencer_id, campaign_id, campaign_set_id})` → OrderDetail.

## C · OrderCartScreen (brand-scope cart → Razorpay checkout)
- `useCart` context. Items w/ qty/remove · breakdown (subtotal/delivery/total) ·
  min-order gate · sticky ink/yellow PROCEED TO PAY {total}.
- Checkout flow (UNCHANGED): sign-in gate → `createOrder({tracking, items,
  delivery_fee})` → `processPayment({amount: amountRupees*100, orderId, keyId})`
  → `verifyOrder` → clear + popToTop.

## Success state
Follower completes a pay/order via Razorpay on the unified light creator-vibe
checkout; creator attribution carried into every txn for commission credit.
