# Stage C — Commerce flows: end-to-end design

**Status:** DESIGN · 2026-07-24 · from the founder's three flow specs (full-screen
post → shop sheet → PDP · Add-to-Bag complete sequence · Buy-Now complete sequence)
**Rule:** copy the reference layouts EXACTLY; palette stays the locked INFLX
canvas (pure white, black, yellow accent) — the references' pink = our yellow.

## 0. The one sentence

Stage C re-skins the money path the platform already runs (cart pricing →
Razorpay → split orders → attribution → returns) into the founder's exact
reference screens, and adds the four genuinely missing capabilities: product
wishlist, follower-initiated cancellation, COD, and order-status history.

## 1. Screen inventory (from the three specs)

### Spec 1 — Post → Shop → Product (5 steps)
| # | Screen | Exists today? |
|---|---|---|
| S1 | Full-screen post, immersive: media fills screen, creator row + Follow + share/⋯ top, right rail (♡/💬/🔖/↗ + counts), bottom-left title+caption+"N PRODUCTS", WHITE Shop-this-post pill | 🟡 PostViewer exists but white-canvas layout — restyle to immersive overlay grammar |
| S2 | Products bottom sheet: "Products in this post · N Items", 3-col GRID cards (image, bag-icon button on image corner, name, price) | 🟡 sheet exists as LIST — regrid + bag-icon quick-add |
| S3 | Bag icon tap → ADD TO BAG from the sheet + toast "added to bag · View Bag" | 🟠 cart context exists; quick-add + toast new |
| S4 | Product Details full: gallery dots, name, price + struck MRP + %OFF, "Inclusive of all taxes", rating, color swatches, Product Details accordion, Add to Bag (outline) + Buy Now (yellow) | 🟡 PDP exists w/ offers+variants; full restyle |
| S5 | Back → returns to the sheet, state preserved | 🟠 navigation wiring |

### Spec 2 — Add-to-Bag sequence (7 pages)
| # | Screen | Exists? |
|---|---|---|
| A1 | PDP bottom actions: Buy Now + Add to Bag; stock status, "Only Few Left!", View Similar | 🟡 restyle; low-stock from `stock`; View Similar = same-leaf rule |
| A2 | Add-to-bag animation → bag count badge + button flips "Go to Bag" | 🟠 client-side |
| A3 | BAG page: tabs Items/Coupons/Price Details · "You are saving ₹N" banner · offer chips (Bundle/Free Gift/Bank/Combo unlocked) · Select All + total · item cards (size selector, qty stepper, price/MRP/%, delivery date, 7-day return, delete) · Share Bag / Delete / Move to Wishlist · "Place Order (n) · ₹X" | 🟡 server cart pricing already returns adjustments+savings (all 5 offer types); UI new. Bank-offer chip = cosmetic-only until bank offers exist |
| A4 | Remove confirmation popup: Remove / Move to Wishlist | 🟠 new |
| A5 | Empty bag: illustration, "Continue Shopping", Recommended For You | 🟠 new; recs = same-leaf rule |
| A6 | WISHLIST (products): filter chips, grid + Add to Bag, out-of-stock tab | 🔴 product wishlist does NOT exist (saves are offer-level) — new table+API |
| A7 | Collections from wishlist | ⏸ founder marked optional → DEFERRED (P7) |

### Spec 3 — Buy-Now sequence (10 screens)
| # | Screen | Exists? |
|---|---|---|
| B1 | Size-selection sheet (Buy Now without size → shake + "Select Size"); Size Chart link | 🟡 variants exist; size chart DEFERRED (no brand size data) |
| B2 | Review Order: address + Change, delivery-by, coupons/bank offers section, Price Details (Total MRP, Discount, Platform Fee "Know More", COD fee, Total), Confirm & Place Order | 🟡 addresses+cart pricing exist; platform-fee & COD-fee lines = new config knobs |
| B3 | Payment Method sheet: COD (+₹10), UPI, Card, Wallets, EMI, NetBanking | 🟡 UPI/card/wallet/EMI/netbanking = Razorpay checkout natively; **COD = NEW path** |
| B4 | Order Success: green check, address, summary, View All Orders / Continue Shopping | 🟡 thank-you exists; restyle |
| B5 | Order Details (active): tracking TIMELINE w/ timestamps (Confirmed→Packed→Shipped→Out for Delivery→Delivered), Track + Cancel buttons, You-might-also-like | 🟡 statuses EXIST in order_status enum (packed/out_for_delivery added mig 105; shipped≈dispatched); **per-status timestamps need order_status_history — NEW** |
| B6 | Track Item sheet | 🟠 same timeline data |
| B7 | Cancel Item: reason radios + optional text | 🔴 follower-initiated cancel does NOT exist — NEW endpoint + rules |
| B8 | Cancellation Success + refund info | 🔴 rides new cancel; refund via existing refund rails |
| B9 | My Orders: tabs All/Active/Delivered/Cancelled | 🟡 old orders screens exist; rebuild to spec |
| B10 | Cancelled Order Details: stamp, reason, refund amount/timeline | 🔴 new |

## 2. Backend verification (2026-07-24, verify-twice)

EXISTS: `follower_orders` + order_status enum incl. packed/out_for_delivery/
cancelled (mig 105) · multi-brand cart server pricing w/ per-item adjustments +
savings (all 5 offer types) · Razorpay order+verify+split · addresses ·
returns flow (post-delivery) · attribution/commission (post tracking rides it)
· delivery-by estimation.
NOT FOUND (new build): product wishlist (saves = offers only) · follower
cancel endpoint + cancellation_reason/refund wiring · COD payment path +
COD fee knob · order_status_history (timestamps per step) · platform-fee
follower line · generic promo-code entry (coupons tab v1 = auto-applied
offers list from the engine; promo codes later) · product-level reviews
(PDP rating row HIDDEN until reviews phase) · bank offers (chip cosmetic
until real) · size chart · wishlist-collections (deferred).

## 3. Build order (each slice ships usable)

- **C1 — The shopping window (spec 1 exact):** immersive full-screen post
  restyle · grid shop sheet w/ bag-icon quick-add + toast · PDP restyle
  (gallery/MRP/% off/swatches/accordion/CTAs) · sheet↔PDP state preserved ·
  View Similar. Backend: none new (PDP payload already carries offers).
- **C2 — Bag + wishlist (spec 2):** bag page w/ tabs, savings banner, offer
  chips, qty/size, select-all, remove-popup, share/delete/move · empty state
  + recs · Go-to-Bag flip + count badge · product wishlist (mig: follower
  product saves + endpoints) · wishlist page w/ out-of-stock tab.
- **C3 — Checkout (spec 3 first half):** size sheet + shake guard · review
  order w/ price-details lines (platform fee + COD fee knobs in payment
  config/app-config) · payment sheet (Razorpay methods + COD w/ admin
  toggle) · order success.
- **C4 — Orders lifecycle (spec 3 second half):** order_status_history mig +
  brand/admin transitions writing it · My Orders tabs · order details w/
  timeline · follower cancel (allowed until 'dispatched'; reasons enum +
  free text; auto refund for prepaid via existing rails; notifications) ·
  cancellation success + cancelled details.

## 4. Decisions — RESOLVED by founder 2026-07-24
1. **COD: BUILD.** Admin on/off toggle + fee amount knob (follower_app_config / payment config).
2. **Platform fee line: NOT REQUIRED.** Line hidden everywhere.
3. **PDP rating row: data-gated + ADMIN KNOB.** Renders only when real review data exists AND admin has enabled `show_product_ratings` (app-config). Never fake numbers.
4. **Cancel window: CONFIRMED** — follower cancels until 'dispatched'; after that, returns flow.
5. Scope list: size chart ❌ dropped · bank offers ❌ dropped (no cosmetic chip either) · **wishlist collections ✅ KEPT in C2 scope** · promo-code entry ❌ NOT NEEDED — founder's architectural insight: every transaction flows through a creator post, so attribution is always known and any brand-allocated offer/code applies AUTOMATICALLY; a typed code has no job.
6. **Design directive (reaffirmed):** reference boards give LAYOUT ONLY. Canvas = pure white, black type, decent typography, yellow MINIMAL — essentially the buy button. No colour copying from references.
7. **Method:** mockup flow-boards (like the founder's references) BEFORE coding each slice. C1 board: features/concept-stagec1-shopping-window/04-preview/mockups/c1-shopping-window.html — awaiting founder lock.
