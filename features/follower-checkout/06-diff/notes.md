# 06 — Before / after notes (Slice A)

**Before:** the cart showed items + bill + Place Order, no recommendations.
**After (`04-preview/mockups/shopping-checkout.html`):** a **"You might also like"** rail
below the bill — same-category cross-sell from the cart items, excluding what's in the cart.

## Delivered
- Backend `GET /follower/cart-recommendations` (sections of cart products → live products in
  those sections, ranked by markdown then newest, excluding cart ids).
- `CartScreen` rail (image · name · price · struck MRP); tap → ProductDetail (organic).
- The follower list stays **one flat list** (locked); the per-brand split is Slice B.

## Verification
- backend load ok; `pnpm qa` GREEN 79; CartScreen babel-compile clean; jest 20/20
  (CartScreen test mock updated for the new api method).
- Capture after Render + OTA + founder re-test.

---

# 06 — Before / after notes (Slice B)

**Before:** the cart's footer was a single green **Place Order** that navigated to
the 3-step `OnlineOrder` screen (one brand only). A multi-brand shop cart could be
built (F8) but checkout assumed one brand.
**After (`04-preview/mockups/shopping-checkout.html`):** for the **shopping** cart
(`cart.kind === 'shop'`) the cart **is** the checkout — a bottom bar with a saved
**Address + Change**, a **payment-method selector** (PhonePe UPI default → other
methods; UI only, mock pay), and **Place Order** that runs the order inline. The
backend **splits the cart per brand** into one order each while the follower sees
**one flat list + bill** and pays **once**. Food / legacy carts keep the existing
3-step `OnlineOrder` flow untouched.

## Delivered
- Backend `placeOrder` extended: pricing extracted to `priceOrderForGroup`; an
  optional `brand_groups[]` prices each brand and creates **one** Razorpay order
  for the summed total holding `sub_orders[]` in the pending-order meta. The
  single-order path (food / single-brand / creator) is unchanged.
- Backend `verifyOrder` restructured (`prepareSubOrder` + `writeSubOrder`): loops
  `meta.sub_orders` (single path = the whole meta), claims the **one** pending
  order atomically, writes one `follower_transactions` + `follower_orders` per
  brand (each with the customer's `address_id`), credits commission + opens the
  attribution window per creator-allocated brand, sends one confirmation + one
  follow-prompt per distinct influencer. Returns `order_id` (primary) + `order_ids[]`.
- `CartScreen` shop checkout bar (address picker sheet · payment picker sheet ·
  inline `createOrder → mock pay → verifyOrder → clear cart → OrderConfirmation`),
  grouping lines by `brand_id` → `brand_groups` when >1 brand, else the legacy
  single payload. Payment selector is UI-only (mock until real Razorpay, P10).

## Verification (Slice B)
- backend loads ok; `pnpm qa` **GREEN 79**; CartScreen transforms clean under the
  RN babel preset (jest); mobile jest **20/20** (FollowerWallet suite = known
  pre-existing baseline transform-fail).
- Single-brand path byte-identical (food/creator unaffected); multi-brand split
  to be founder-verified on the live [FTW] world after Render + OTA.

## Slice B follow-up — Razorpay prefill (founder live-test, 2026-06-27)

Founder finding: prod uses **real Razorpay** (not the mock we assumed); its
checkout was (a) showing a contact-collection step even though we have the
follower's phone, and (b) showing its own method chooser after our in-app
payment row — a redundant double-pick.

Fix (mobile only, no backend): `processPayment` now forwards `prefill.contact`
(→ Razorpay **skips** its "enter phone number" step) and `prefill.method`
(→ Razorpay opens **focused** on the chosen method's tab). `CartScreen`
(shop) reads the follower's phone from `inflx_user` and maps the selected
payment row → Razorpay method (`upi`/`card`/`netbanking`); `OnlineOrderScreen`
(food/creator) passes the contact too. NOTE: fully bypassing Razorpay's chooser
to launch ONE app (PhonePe) directly is **not supported by Razorpay Standard
Checkout** — that needs the UPI-Intent/custom-checkout flow (Razorpay-side,
deferred). jest 20/20 (FollowerWallet baseline excl.).
