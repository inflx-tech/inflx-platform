# 01 — Spec: follower-creator-attribution

Locked framing with the founder 2026-06-28. Two sides of every buy:
**creator-credited** vs **natural/organic**. The governing principle:

> **Organic is the default. A creator earns credit ONLY when a proof-of-claim is
> attached to that specific item.** The claim lives on the LINE (per product),
> captured at add-time, last-click single-winner. At checkout the cart splits by
> (brand + claiming-creator); the follower still sees ONE flat list and pays once.

## The one rule (per item, priority order)
1. **Link/store** — item added from a creator's store/link → that creator's tag is
   stamped on the line. (Strongest.)
2. **Code** — a valid creator code entered at checkout claims that creator's
   **allocated products** for that brand (rest stay organic).
3. **(Parked — #3)** live 30-day window from a prior creator buy.
4. **None → ORGANIC** (brand + platform only, no commission).

## Scope (this contract = 4 slices)
- **Slice 1 — Per-line claim (spine).** CartContext stores a per-line `claim`;
  CartScreen groups `brand_groups` by (brand + creator). Backend `placeOrder`
  already prices each group independently — no backend change expected.
- **Slice 2 — Code door.** New `POST /follower/resolve-coupon` (code → creator,
  validated contracted/active) + a "Have a creator code?" field in the cart that
  stamps the claim on the creator's **allocated** lines for that brand and shows
  the discount. (Code scope = allocated products only — founder-locked.)
- **Slice 3 — Link door (deep-link).** `Linking` handler + NavigationContainer
  linking config for `inflx.in/s/{handle}?cid&sid&oid&iid` → creator store with
  tracking. JS via OTA; the Android manifest intent-filter rides the next APK.
- **Slice 4 — Post-order notify.** In `verifyOrder`'s per-sub loop, send the
  creator a `commission.sale` ping and the brand an `order.placed` ping.

## Out of scope
- **#3** the 30-day window paying creators on repeat buys (separate future slice;
  today the window only lowers INFLX's fee tier — it pays the creator ₹0).
- Real Razorpay multi-method (Program B P10). Admin order-count/SLA dashboard.

## Acceptance
- A mixed cart (creator-link item + code item + organic item, across brands)
  credits **each** creator only for the items they drove; organic items pay no
  commission. Follower sees one flat list + one bill.
- Code entry applies the creator's discount + attribution with no link.
- Creator link opens the app into the creator store with the tag (on APK).
- Creator + brand are notified on each placed sub-order.
- `pnpm qa` green; mobile jest green; mockups locked before code.
