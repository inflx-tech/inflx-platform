# shopper-ordering — before / after

**Before** = the locked board `04-preview/mockups/shopper-ordering-mockups-final.html` (38 screens: O1, O2, D1,
P1–P3, B1–B4, V1–V4, K1–K5, G1–G5, D4, D11, O6–O17), locked by the founder in chat on 30 Sep 2026, with rules
v1.13 §6 (the money split added the same day).

**After**, four ways:
- **Phone screens** — rendered in the phone app's test runner with the board's data, each flow driven by taps
  (`order17.test.js`, 13 checks; `shop15.test.js` updated for Add and the live Addresses row); the whole phone
  suite passes (787); the app bundle builds. **Not walked on a phone** — that follows the OTA (check C39, the
  founder's walk at the end).
- **Server** — proved end to end on the test database (`shopper-ordering.test.js`, 36 checks: every price rule of
  the board, the three-way split, stock races, COD, online with verify and webhook, the 15-minute hold, cancelling
  with refunds and claw-backs, the brand's forward-only statuses, the money jobs on the new rows, the retired routes).
- **Website** — the brand's Fulfilment page and INFLX admin's Follower App settings walked in the in-app browser
  against a local server on a private preview database (never production), seeded through the real checkout:
  3 parcels (cash on delivery; online with one item cancelled by the shopper; online shipped with Delhivery).
- **Migration 198** — applied cleanly on a fresh database carrying every migration 001–198.

| Board | What it does now | Same as the board? |
|---|---|---|
| O1 Size and colour | Colours as chips, sizes with sold-out crossed out, "Only 2 left" at ≤3, size chart when given, price after the offer with the normal price struck, "from Priya's post"; Buy now · Add to bag; Add waits for a size ("Choose a size"). | Yes. Colours are named chips (no colour codes exist in the listings). |
| O2 Shop this post with Add | Add on each product; "✓ In your bag · 32" after adding; "Go to bag · n"; the bag icon with its count in the top bar of every screen that has search. | Yes |
| D1 A deal post | Shop this post shows the offer, how it works, "n products · n gifts", and Build your deal; Add on a product opens the deal page with that product's pop-up. | Yes |
| P1–P3 Picking | The grid (photo, name, price, colours · sizes), the product pop-up (photos, price, what picking it does from the server, colours, sizes, details, quantity where it applies), Pick → closes → "✓ Picked · Blue · 32"; tap again to change or Remove. | Yes |
| B1–B4 BOGO | One pop-up in two parts: "1 · The one you pay for" → Next: your free one → "2 · Your free one" (same product, any colour or size) → Pick this pair; pairs listed with Remove, up to the max. | Yes |
| V1–V4 Buy more, save more | The ladder (her tier filled, the next dashed), quantity in the pop-up, the card's price after the tier and ×count, the bar "1 more → 30% off"; value tiers in ₹. | Yes |
| K1–K5 Bundle | Slots at the top filled with each pick, "Put in set · slot n of 2"; mix & match with category tabs; fixed as a list, each item's pop-up "Done", "✓ Chosen". | Yes |
| G1–G5 Free gift | Two steps at the top; step 2 locked until the server says the threshold is met; every gift with worth, "3 left", "All given"; one gift in the pool shows "Your gift: …" and is added by itself. | Yes |
| D4 Review your deal | Each item with colour and size, Change · Remove, the gift at ₹0 with its worth, the price rows from the server, You save; Buy now · Add to bag. | Yes |
| D11 · O6 · O7 The bag | Grouped by post with creator · brand and the offer; Edit deal on deal groups; tick boxes (unticked items stay, listed below); qty 1–5, Change · Remove · Move to Saved; "Price changed from ₹…", sold-out and "No longer available with this offer" from the server; price rows; Continue · ₹total. | Yes |
| O8 Guest at Continue | "Sign in to place your order" + the board's line + Get OTP → the existing sign-in → checkout; the phone bag joins her account. | Yes |
| O9 · O10 Addresses | Saved addresses (default first), Deliver here, Edit, Delete; add by hand with every field of the board, the state from the list, Home/Work/Other, default; up to 10. | Yes |
| O11 · O12 Review and pay | Deliver to + Change; one card per brand with "Arrives by …" and its items; price rows; UPI/cards/net banking (Razorpay) or Cash on delivery (greyed with "Not available above ₹5,000"); Place order · ₹total; a changed total shows the new review. | Yes |
| O13 Order placed | ✓, "₹… paid online / to pay on delivery", each parcel with items and date; My orders · Keep shopping. | Yes |
| O14 · O15 My orders, details | Items newest first with status and date, filters and search; the timeline, courier and tracking once shipped, the address, what she paid, the post. | Yes, except **Need help**: not shown until INFLX's support contact is decided (owed, §7). |
| O16 · O17 Cancel | The warning for deal items, the reasons (Other needs a note), the refund line; then Cancelled with the refund in plain words. | Yes |
| Website · Fulfilment (not on the board) | Parcels with each item's size, post code and creator, and each item's creator / INFLX / brand shares to the paisa; the parcel's four totals; the cash-on-delivery note; Mark Packed → Shipped (courier + tracking) → Out for delivery → Delivered; "Can't send this · cancel" with a reason per item. | Adapted page (impact §"Not designed on the board"). |
| Admin · Follower App (not on the board) | Cash on delivery switch (on unless switched off, as the server reads it), COD limit ₹5,000, COD fee, delivery fee, free-above. | Adapted page. |

## Found while building
- **Admin Orders was broken in production**: its list asked for `follower_transactions.platform_fee`, renamed to
  `marketplace_fee_amount` by migration 059, so the page errored. Fixed with the parcel sums.
- **The admin COD switch showed OFF while the server treated COD as ON** (no value stored). Both now read it the same.
- **Bag order**: items saved together came back in random order (they share the transaction's time). Fixed.
- **Rounding** was two-decimal on the post card (₹1,839.20) — now to the rupee per unit, as the rules say (₹1,839);
  three older checks updated to the rule.
- **Settlement retry would have paid cash-on-delivery sales** (no payment to transfer from) and ignored dues taken
  from a payout; both closed.
- The brand's money split displayed in whole rupees looked like it did not add up (₹140 + ₹70 + ₹1,186 for ₹1,395);
  it now shows paise when there are any (₹139.50 + ₹69.75 + ₹1,185.75).
- **Regression (whole backend suite, serially, before vs after on the same test database):** before 1,734 tests,
  194 failing; after 1,757 tests (36 new), 181 failing — **the same 181 as before, no new failure**. The 13 others
  were the retired checkout's own tests. Six failed on the first after-run and were resolved: four address tests and
  one retire-google test posted addresses in the old shape (updated to rules 6.7: name, phone, area, state; an unlisted
  town is now kept by hand), and one was **a real defect caught by C34** — allowing "Out for delivery" to be skipped
  had also let a brand jump from Confirmed straight to Delivered; fixed (skipping is allowed only after Shipped).
