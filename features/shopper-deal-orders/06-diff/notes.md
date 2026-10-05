# shopper-deal-orders — what was built, against the locked board

Board: `04-preview/mockups/shopper-deal-orders-mockups-v1.html`, locked by the founder on 5 Oct 2026.
The round is built in three parts (01-spec.md §6). This file is added to as each part is built.

## Where this stands — read this first

| Part | Built | Released |
|---|---|---|
| C — buying one item of an offer alone (B1–B7) | **yes**, 5 Oct 2026 | **on his go of 5 Oct 2026** ("pls relese this part") — server, website, shopper app update; no migration |
| A — My orders by deal (O1–O4) | no | — |
| B — replace one item / refund its share (R1–R10) | no | — |

Nothing of part C has been seen on a phone. The website switch was seen in the local preview.

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
