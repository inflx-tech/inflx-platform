# shopper-deal-orders — what was built, against the locked board

Board: `04-preview/mockups/shopper-deal-orders-mockups-v1.html`, locked by the founder on 5 Oct 2026.
The round is built in three parts (01-spec.md §6). This file is added to as each part is built.

## Where this stands — read this first

| Part | Built | Released |
|---|---|---|
| C — buying one item of an offer alone (B1–B7) | **yes**, 5 Oct 2026 | **LIVE 5 Oct 2026** on his go ("pls relese this part"): commits `783b2bd9` + `ba579bc5`, shopper app update **236** (brand 242, creator 231 not touched); no migration |
| A — My orders by deal (O1–O4) | **yes**, 5 Oct 2026 | **LIVE 5 Oct 2026** on his go ("Ok pls release part 2"): commit `e9e6bf21`, shopper app update **237** (brand 242, creator 231 not touched); no migration. The server's part is behind sign-in and cannot be read from outside — the proving click is My orders on the phone |
| B — replace one item / refund its share (R1–R10) | **yes**, 5 Oct 2026 | **on his go of 6 Oct 2026** ("pls go and release") — database change applied on live first (nothing moved), then server, website, shopper app update |

Nothing of part C has been seen on a phone. The website switch was seen in the local preview, and its words are in the live website's scripts. The live server was read as a guest after each push: every post says whether a product can be bought alone, and what one costs alone equals what the bag charges for it.

**For the walk:** the live shop has no bundle ("any 2 for ₹…") post today — only a set, a buy-more post, a buy-one-get-one post and a 20% discount. The buy-more post shows "Buy this alone" now; to see the bundle screens (B1, B5, B6) a bundle offer and a post on it are needed.

## Part B — one item of a deal is replaced, or its share refunded

### Before → after, screen by screen
| Frame | Before | After |
|---|---|---|
| O4 → R1 | A delivered deal had "Return deal": whatever the reason, the whole deal went back. | The button is **Return or replace**. It asks first: "One item is not right · Replace it. The deal stays." or "Return the whole deal · All 3 items go back. Refund of ₹2,999.", with until when. |
| R2 | — | Which item, and what is wrong: the size doesn't fit · it arrived damaged · it isn't as shown. |
| R3 | A size that didn't fit could only be returned, with the whole deal. | Its sizes; the one she has and sold-out ones cannot be chosen; another colour of the same product can. "Replacement: Slim Jeans · 34. The deal stays and no money moves." "The store brings it and collects the 32." → Request replacement. |
| R7 | — | No other size in stock: "You can keep it, or return the whole deal." → Return the whole deal, with the reason already "the size doesn't fit". |
| R4 | A damaged item could only be returned, with the whole deal. | "Replace with the same item · In stock"; she writes what is wrong → Request replacement. |
| R5 | The whole deal went back and all of it was refunded. | "The store has no more of this. INFLX refunds this item's share: ₹1,250. You keep the rest of the deal." What she keeps; her words → Request refund for this item. |
| R6 | "Return", with the warning "this is part of a deal". | The Return screen of part A, opened from R1 (or from R7 with the reason chosen). |
| R8 | Only a return had a box on the order page. | The same box for a replacement — REPLACEMENT · Replacement requested / approved ("The store will bring Slim Jeans · 34 and collect the 32.") / Replaced ("Slim Jeans · 34 delivered Wed, 7 Oct.") / not accepted, with INFLX's note — and for a one-item refund. The same word is on the deal's card. |
| R9 · brand website | The page only said "return requested" on a parcel. | **Replacement to send**: Send · Collect · To · Why, **Mark sent** → **Mark delivered**, "Nothing is added to or taken from your wallet for a replacement. You bring it and take the other item back at your own cost." The parcel's row says which kind of request is open. |
| R10 · admin | Returns listed returns only, with no kind. | A **Type** column: Replace · Refund one item · Return; a **Replaced** tab; Approve says what it does for that kind; a replacement has no "Mark Refunded". |

### Where the build departs from the board's first words — and why
- **A replacement that sells out before INFLX can approve it closes by itself.** Not on the board. The replacement is taken from stock at approval, not when she asks; if the last one was sold meanwhile there is nothing to approve. The request is closed with the note "It sold out before it could be sent. You can choose another size, or return the whole deal." It does not count as INFLX's answer for that item: she may choose again.
- **INFLX's Returns lists a whole-deal return as one row per item** ("3 items together"), as it did; the board draws it as one row. Approving or rejecting any of them decides them all, as before.
- **A "Replaced" tab** on INFLX's Returns (the board has none): otherwise a finished replacement is on no tab.
- **An item of two** (two of the same size in a bundle) is split into two items of one before the request is recorded — money-neutral, kept even if the request is refused.
- **Stock that comes back:** only for "the size doesn't fit". A damaged item, or one not as shown, is not put back on sale.
- **The window after a replacement** runs again for the whole sale — everything she bought from that post in that order — not only the deal's items: the money of a sale is released as one.
- **"The store brings it and collects the 32."** is said for a size; for the same item again it is "…collects the other", and the box says "another Slim Jeans".
- **Not built — a damaged free gift being replaced** (one cell of the board's table). No screen is drawn for it and a gift has no page of choices today.

### What was changed
- **Database** — migration `204_return_kinds_and_replacements.sql` (additive): the kind of a request, what it is replaced with, where the replacement is, "sold out", one new state ("replaced"); a sale's "window runs again from". Run on live with `backend/scripts/run-204.js --dry`, then `--apply` (it prints what must not move, before and after).
- **Server** — `shopperReturns.service.js` (kinds; asking; INFLX's decision; the brand sending; the deal's state), `shopperOrders.service.js` (the deal's request on its card and page; an item that went back; the parcel's wording), the two money jobs + `settlement.service.js` + `walletRead.service.js` (the window's start), `returns.controller.js` (the lists), routes `GET/POST /follower/orders/lines/:id/replace`, `GET /brands/me/replacements`, `PATCH /brands/me/replacements/:id/status`.
- **Shopper app** — new `order/ReplaceScreen.js` (route `ReplaceItem`); `OrderScreens.js` (the button; an item that went back), `ReturnScreen.js` (the box by kind; a handed-over reason), `copyReturn.js`, `services/api.js`, `FollowerNavigator.js`.
- **Website** — `app/admin/returns/page.js`, `app/dashboard/fulfillment/page.js`, `app/dashboard/returns/page.js`, `lib/api.js`.
- **Rules** — v1.21 (§6.16).

### Tests (5 Oct 2026)
- Server, this part: `shopper-deal-orders-replace.test.js` — 20/20, real orders through a live bundle post whose products have sizes with stock; the money jobs are run for real.
- Phone, this part: `shopperDealOrdersReplace.test.js` — 34/34.
- 46 rules were broken one at a time (30 on the server, 16 on the phone). 41 were caught at once; four were not, and each got its own assertion (the settlement service and the wallet's date after a replacement; the brand's list before approval; the money jobs' clock) and is caught now. One is not a fault that can show: an item that had its answer is refused twice — the row cannot be pressed, and Continue stays off — so removing one of the two changes nothing she can see.
- Two existing tests were moved to the new shape (drift table in 03-expected-outputs.md).
- Phone, whole suite: 118 suites, 2,750 tests, all passing.
- Server, whole suite: 147 suites / 2,008 tests — 0 tests that passed before fail now, 0 new tests fail, the same 177 old failures (`backend-compare.txt`, part B). A first run was thrown away because one server file was edited while it ran; this is the run on the final code.
- The live-database script was tried on a scratch database built without the change: dry run, apply, apply again — the second apply changes nothing.
- Web: the four pages were walked in the local preview on a private database seeded with one request of each kind (03-expected-outputs.md, BW1–BW4).

### What to check at the walk (after release; close the app fully and open it twice first)
- A delivered set or pair → its page → **Return or replace** → One item is not right → pick the item → "The size doesn't fit" → another size → Request replacement. The deal's page then says "Replacement requested".
- Admin › Returns → the row says **Replace** → Approve.
- Brand website › Fulfillment → **Replacement to send** → Mark sent → Mark delivered. The shopper's deal then says "Replaced" and shows the new size.
- The same with "It arrived damaged" on a product that has stock (same item again), and on one whose stock is 0 (refund of that item's share → Admin approves → Mark Refunded).

### Release, when the founder says go (production-impacting — never silent)
1. `node scripts/run-204.js --dry` on live, read it; then `--apply` (the database change first: the new server needs it).
2. Commit by path, push (the server and the website redeploy).
3. Check the live server (the new routes answer "sign in" instead of "not found").
4. Publish the shopper app update only.
5. The founder's walk.

Undo: revert the commit and push; publish the previous shopper bundle (237). The database change is additive and can stay.

## Part A — My orders shows a deal as one

### Before → after, screen by screen
| Frame | Before | After |
|---|---|---|
| O1 · My orders | Every item its own row, also the three items of one deal; nothing said they belong together. | A deal is **one card**: its status and date ("Delivered" + the day; "Shipped" + "Arrives by …"), the deal's words, its items with colour and size (a pair says what the paid one cost and "Free"), the brand, what the deal cost. A plain-discount item keeps its own row, now with its normal price struck beside what it cost. |
| O2 · the deal's page, before it ships | Order details was one item's page; its button read "Cancel". | Any item of a deal opens **the deal**: "Akshaya · Aveen…" and the deal's words, every item, "Paid ₹2,999 · UPI, cards, net banking" (the deal's amount, not one item's), one timeline, the address, "See the post · from Akshaya's post", and one button, **Cancel deal**. |
| O3 · Cancel deal | "Cancel", opened from one item, with the warning "This is part of a deal. Cancelling cancels 3 items together." and the button "Cancel item". | Titled **Cancel deal**: the deal's words, who it is from, its items with colour and size, the same seven reasons, "Refund of ₹2,999 to your original payment method in 5–7 working days", the button **Cancel deal**. No warning — the page itself says it. |
| O4 · the deal's page, after delivery | Each delivered item had its own "Return". | One button, **Return deal**, with until when. The Return screen is titled "Return deal" and lists the deal's items. |

### Where the build departs from the board's first words — and why
- **O4's button reads "Return deal", not "Return or replace".** Replacing one item is part B and is not built; a button that promised it would be untrue. It becomes "Return or replace" when part B is released.
- **Buy more save more is one card too** (my note E1, shown on the board's table and not overruled): the items the saving applied to. Its card's words are the offer's ladder ("Buy 2 → 20% · Buy 3 → 30%").
- **A gift offer's items and its gift are each their own card**, as before; the gift still follows what earned it when that is cancelled (the old warning stays for that case).
- **The single item's row is the row it was**, plus the struck normal price the board shows. It was not redrawn as a card: nothing about it changes.
- **An app not yet updated** asks for My orders the old way and gets every item on its own, exactly as before — the server answers cards only when asked "by deal".
- **20 cards a page**, not 20 items: a deal is never split across two pages.

### What was changed
- **Server** — `offerRules.js` (`orderDealWords`), `shopperOrders.service.js` (`listCards` behind `GET /follower/orders?by=deal`; `deal` on order details and on the cancel preview; `delivered_at`), `shopperReturns.service.js` (`deal` on the return preview). Read-only: nothing about cancelling, returning or money changed. No migration.
- **Shopper app** — `order/OrderScreens.js` (My orders, Order details, Cancel), `order/ReturnScreen.js`, `copyOrder.js`, `copyReturn.js`, `services/api.js` (My orders is asked for by deal).
- **Rules** — v1.20 (§6.11, §6.12).

### Tests (5 Oct 2026)
- Server, this part: `backend/tests/shopper-deal-orders-orders.test.js` — 16/16: real orders through live posts of each kind (a bundle, a pair, a discount item, a buy-more deal, one item bought alone, a gift offer), 23 cards across two pages, the deal's page, Cancel deal and Return deal.
- Phone, this part: `shopperDealOrdersOrders.test.js` 20/20, `ordersByDeal.test.js` 4/4.
- 30 changes were put back or broken one at a time (13 on the server, 17 on the phone) and a test failed every time. One was not caught at first — "an item in no deal still gets a deal" — because no test had a gift offer's order; that test was added (AS4) and it is caught now.
- Phone, whole suite: 117 suites, 2,716 tests, all passing.
- Server, whole suite: 146 suites / 1,988 tests — 0 tests that passed before fail now, the same 177 old failures. One of this part's own new tests failed in that run through a flaw in its fixture (it named a line by its place, and lines placed together are ordered by a random id); corrected and run four more times, 35/35 each (`backend-compare.txt`, part A).

### What to check at the walk (after release; close the app fully and open it twice first)
- Order a set (or a buy-one-get-one pair) → My orders shows it as one card with the deal's words. A discount item ordered the same day is its own row.
- Tap the card → the deal's page: all items, what was paid for the deal, **Cancel deal**.
- Cancel deal → the deal's items, a reason, the refund of the whole deal → all of them are cancelled together.
- After the brand marks one delivered → the deal's page has **Return deal** with until when.

### Release, when the founder says go (production-impacting — never silent)
1. Commit by path, push (the server redeploys; the website is not changed). No migration.
2. The server's part is behind sign-in and cannot be read from outside — the proving click is My orders on the phone.
3. Publish the shopper app update only.

Undo: revert the commit and push; publish the previous shopper bundle (236).

## Part C — one item of an offer can be bought alone

### Before → after, screen by screen
| Frame | Before | After |
|---|---|---|
| B1 · product page, bundle post | One button, "Build your deal". The product could not be bought alone. | "Buy this alone · ₹1,999" over **Buy now** and **Add to bag** (normal price), and the strip "In an offer: Any 3 for ₹2,999 · See offer ›", which opens the deal page with this product started. The same on a buy-more-save-more post and a gift-offer post. |
| B2 · product page, buy one get one | "Build your deal". | The line "Buy one, get one free. Pick your free one next." and one button, "Get this offer". No "alone". |
| B3 · product page, set | "Build your deal". | "Sold as a set." and "Build your deal". When the brand has switched on "Pieces can also be bought alone": the two choices of B1. |
| B4 · Products in this post | The bag icon on an offer post's product opened the deal page. | It opens the size sheet: the normal price, "from Akshaya's post", Buy now, Add to bag, and "Or get it in the offer: Any 3 for ₹2,999 ›". "Build your deal" is still at the foot. On a buy-one-get-one post, or a set sold only whole, the bag icon opens the deal page as before. |
| B5 · bag, one item alone | Such a row could not exist. | An ordinary row: tick, − 1 +, Change, Remove, Move to Saved, ₹1,999; under it the nudge "Add 2 more from this post and get all 3 for ₹2,999 · See offer ›" (opens the deal page with what she has from that post); "+ Add more from this post". The header says who it is from and no more. |
| B6 · bag, the three complete the offer | The three reached the bag only together, from the deal page. | Added one by one, the server prices them as the deal by itself: one tick, Edit deal, the three items with nothing to press, "Set complete · you save ₹1,798 · ₹2,999" with ₹4,797 struck, "The offer applied by itself.", Remove deal. |
| B7 · brand website, a set | No such switch; a set was sold only whole. | On the Numbers step of a Bundle · Fixed draft: the switch "Pieces can also be bought alone", off. The review step and the published offer's page say how it was set. |
| C7 · Saved | A saved product only offered "Open post ›". | Tapping its photo or name opens its product page (B1, B2 or B3). "Open post ›" stays. |

### Where the build departs from the board's first words — and why
- **The switch can change only while the offer is a draft.** My note E8 said "switching it on or off never changes an order already placed", which reads as if a live set could be switched. A published offer's numbers are frozen (rules 1.x — creators' terms and posts promise that deal), and this switch is one of them. To open a set that is already live, the brand builds a new offer. The published offer's page says which way it was set.
- **More than the deal needs** (four items of "any 3") is not on the board. Built as: the three the server puts in the set (the costliest, the best saving for her) are the deal block; the fourth is an ordinary row under it with "Add 2 more to complete another set of 3 for ₹2,999 · See offer ›". Remove deal and the deal's tick act on the three only.
- **Two of one size, one in the set and one outside**: it shows in both places; the row below acts only on the one outside (− 1 + and Remove; no tick, Change or Move to Saved there, since those would also change the set's piece).
- **"The offer applied by itself."** shows only when she added an item of that post alone since the app was opened. A deal she built on its deal page does not say it.
- **"Change" on an item bought alone** opens the size-and-colour pop-up (as for any single item). On a buy-more or gift deal it still opens the deal page, as before.
- **The header of a bag group with nothing in a deal yet (B5)** has no offer line and no "Edit deal"; the offer is in the nudge.
- **The nudge for a set whose pieces are sold alone** is not on the board: "Take the whole set of 3 and pay ₹5,000 · See offer ›".
- **"Buy this alone · ₹X" says what one really costs, which is not always the normal price.** Found at the live check after the server was released, before the app update went out: the founder's own buy-more post has a ladder that starts at "Buy 1 → 10%", so one Henley tee alone costs ₹629 — and the label would have said ₹699. The server now sends `alone_price` (the price engine's own answer for one unit, per product and per size) and the product page and the size sheet show it, with the normal price struck. For a bundle, a set and a gift offer it is the normal price, as the rule says.
- **On the board the example's prices (₹1,299 / ₹1,499 / ₹1,999) would not pass the builder's own check** for a pick-any bundle (the costliest may be at most 1.5 × the cheapest). They are an illustration; nothing in the build depends on them.

### What was changed
- **Server** — `offerRules.js` (`pieces_alone` on a set; `aloneAllowed`; the set's sentence), `orderPricing.service.js` (a piece of an opened set outside a whole set pays its normal price and blocks nothing; `offer.alone`; `alone_nudge`), `shopperCheckout.service.js` (the nudge is delivered with the priced bag), `shopperOrders.service.js` and `shopperPosts.service.js` (`buy_alone` on the deal data and the post card). No migration. What a deal costs is untouched.
- **Shopper app** — `ProductScreen.js`, `components/shop/bitsShop.js` (Products in this post), `orderBits.js` (size sheet), `order/BagScreen.js`, `order/DealReviewScreen.js`, `SavedScreen.js`, `copyOrder.js`, `bag.js`.
- **Brand website** — `components/offers/NumbersPanel.js`, `OfferWizard.js`, `OfferPage.js`, `offerCss.js`.
- **Rules** — `Docs/OFFER_TERMS_POSTS_RULES.md` v1.19 (§6.2–6.6 and the change log).

### Tests (5 Oct 2026)
- Server, this part: `backend/tests/shopper-deal-orders.test.js` — 19/19 (the engine alone, then real posts of each kind through the real API, an order placed for one item of a bundle post).
- Phone, this part: `shopperDealOrdersAlone.test.js` 28/28, `shopperDealOrdersBag.test.js` 20/20.
- Each change was put back to the old behaviour one at a time (35 in all: 21 on the phone, 14 on the server) and a test failed every time.
- Phone, whole suite: 115 suites, 2,692 tests, all passing (was 113 / 2,644).
- Server, whole suite: see `backend-compare.txt`.
- One existing test moved to the new rule: `offers-v2-rules.test.js` "stray fields are dropped" now expects a set's numbers to carry `pieces_alone: false` (03-expected-outputs.md, drift table).
- Brand website: seen in the local preview on a private database — the switch off on a new Bundle · Fixed draft; switched on, the review step reads "Pieces alone · A piece can also be bought alone, at its normal price"; after Publish the offer's page reads "A piece can also be bought alone, at its normal price."

### What to check at the walk (after release; close the app fully and open it twice first)
- Open a bundle post ("Any 2 for ₹…") → a product's photo → "Buy this alone · ₹…", Buy now, Add to bag, and the offer strip. Add to bag.
- The bag: that item is an ordinary row with the nudge. Add the others from the same post, one by one → they become one deal at the offer's price, with "The offer applied by itself."
- "Products in this post" on that post: the bag icon on a product opens the size sheet, with "Or get it in the offer ›".
- A buy-one-get-one post: the product page says "Get this offer"; the bag icon opens the deal page.
- A set post: "Sold as a set." · Build your deal.
- Saved › Products: tap a product → its product page.
- Website: New offer → Bundle → Fixed → the Numbers step has the switch.

### Release, when the founder says go (production-impacting — never silent)
1. Commit by path, push (the server and the website redeploy). No migration.
2. Check the live server sends `buy_alone` (public: `GET /v1/follower/posts/<a live deal post>/deal`).
3. Publish the shopper app update only (brand and creator apps are not changed).
4. The founder's walk.

Undo: revert the commit and push; publish the previous shopper bundle (235).
