# shopper-deal-orders — a deal is ordered, cancelled and returned as one; one item can be replaced; one item can be bought alone

**Status:** LOCKED by the founder, 5 Oct 2026 (chat: "Also lock the screens design round"). Board: `04-preview/mockups/shopper-deal-orders-mockups-v1.html` (23 frames). Build order: §6; each part is released only on his go.
**Where it comes from:** his message of 4 Oct ("cancelling the orders flow should happen offer level not individual products level… in a bundle say we have three items, 2 items are fine but one item is not ok to shopper… even in offers shopper can save or add to wishlist, if he needs only one item then he can buy that individual, but as a platform we inform him some offer is running on it") and his answer of 5 Oct to the recommendations: "Yes your recommendation is accepted" (point 3) and "I accept all your recommendations" (point 4).
**Rules touched:** `Docs/OFFER_TERMS_POSTS_RULES.md` §6.5 (a deal item is never added alone — reversed for some offers), §6.6 (the bag), §6.12 (cancelling), §6.16 (returning). Boards this continues: `features/shopper-ordering` (final, 30 Sep), `features/shopper-walk-fixes` (4 Oct).

## 1 · What changes

### A · My orders shows a deal as one
| ID | Today | After | Frame |
|---|---|---|---|
| A1 | My orders lists every item separately, also the items of one deal. Each item has its own Cancel / Return, with a warning that the others go with it. | A deal is **one card**: what the deal is ("Any 3 for ₹2,999"), its items, one status, one price. A plain-discount item, or an item with no offer, stays a card of its own. | O1 |
| A2 | Order details is one item's page. | A deal's page shows all its items, one timeline, the address, what was paid for the deal, and **one** button: "Cancel deal" before it ships, "Return or replace" once delivered. | O2, O4 |
| A3 | Cancelling one item of a deal cancels the deal, after a warning. | "Cancel deal": a reason, then all its items are cancelled together and the whole deal is refunded. Nothing new in the rule — it is said once, up front. | O3 |

Which orders are one card: a **set**, a **bundle** (pick any, mix & match), **buy one get one** (each pair), **buy more save more** (the items the saving applied to). Not one card: a plain discount, and spend-or-buy-for-a-gift — there each item stands alone, and the free gift is shown with them and follows them, as today.

### B · One item of a deal is not right
| ID | Today | After | Frame |
|---|---|---|---|
| B1 | Returning one item of a deal returns the whole deal. | "Return or replace" first asks what she wants: **"One item is not right"** or **"Return the whole deal"**. | R1 |
| B2 | — | One item, **the size doesn't fit** → she picks another size of the same product that is in stock → "Request replacement". The deal stays, no money moves. If no other size is in stock: "No other size is in stock. You can keep it, or return the whole deal." | R2, R3, R7 |
| B3 | — | One item, **it arrived damaged** or **it isn't as shown** → "Replace with the same item" when the store has one → "Request replacement". | R4 |
| B4 | — | …and when the store has no more of it: INFLX refunds **that item's share** of what she paid and she keeps the rest of the deal. The share is the part of the deal's price that item carried when she ordered (split by the items' normal prices). The store collects the item; the refund follows once it is back — to her original payment method, or sent by INFLX directly when she paid cash (as a return is refunded today). | R5 |
| B5 | Whole deal back, full refund. | "Return the whole deal": exactly as today, with today's five reasons (the size doesn't fit · it arrived damaged · it isn't as shown · I changed my mind · other). Coming from "no other size is in stock", the reason is already "the size doesn't fit". | R6 |
| B6 | — | What she sees meanwhile, on the deal's card and page: "Replacement requested" → "Replacement approved · the store will bring it and collect the other" → "Replaced". | R8 |
| B7 | The brand sees a return and is told. | The brand's Orders page shows a **replacement to send**: which item goes out, which comes back, to whom; it marks it sent and delivered like a parcel. Nothing is added to or taken from its wallet. | R9 |
| B8 | INFLX approves or rejects a return, then marks it refunded. | The same page decides all three kinds — **Return · Replace · Refund one item** — each named in its row. | R10 |

Never: returning one piece and keeping the others at the deal's price because she changed her mind. That would turn "any 3 for ₹2,999" into "any 2 for ₹1,750" for anyone who asks.

### C · Buying one item out of an offer
| ID | Today | After | Frame |
|---|---|---|---|
| C1 | On an offer post the product page has one button, "Build your deal". | Two choices: **"Buy this alone · ₹1,299"** (Add to bag, Buy now — at its normal price) and a strip **"In an offer: Any 3 for ₹2,999 · See offer ›"** that opens the deal with this product started. | B1 |
| C2 | — | **Buy one get one:** no "alone" — she pays the same either way and would lose the free one. The button reads "Get this offer". | B2 |
| C3 | A set is sold only whole. | A set stays whole — unless the brand has switched on **"Pieces can also be bought alone"** for that offer. | B3, B7 |
| C4 | In "Products in this post" the bag icon on an offer post's product opens the deal page. | The bag icon adds that product alone (the size sheet, normal price), with a line under the sizes: "Or get it in the offer: Any 3 for ₹2,999 ›". "Build your deal" stays at the foot of the sheet. | B4 |
| C5 | — | In the bag an item bought alone is an ordinary row (− 1 +, Remove) with a nudge under its post: "Add 2 more from this post and get all 3 for ₹2,999 · See offer ›". | B5 |
| C6 | — | When the items in her bag from one post complete the offer, the offer's price applies by itself and they become one deal (the whole-deal group of 4 Oct). | B6 |
| C7 | A saved product only offers "Open post". | Tapping a saved product opens its product page, with the same two choices. | — |

Alone is always the normal price. The offer's price applies only when the offer is completed — never a part of it.

## 2 · By kind of offer (table T on the board)
| Offer | One card in My orders | Buy one alone | One item replaced | One item's share refunded |
|---|---|---|---|---|
| Plain discount, or no offer | no — each item its own | it already is | each item is returned on its own, as today | — |
| Bundle (pick any, mix & match) | yes | yes, normal price | yes | yes, when it is the store's fault and it cannot replace |
| Set | yes | only if the brand allows | yes | yes, same condition |
| Buy one get one | yes, each pair | no | yes, either item of the pair | the pair goes back together (a refund is for the pair) |
| Buy more save more | yes, the items the saving applied to | yes, normal price | yes | yes, same condition |
| Spend or buy for a gift | no — each item its own; the gift follows | yes (it already is) | each item on its own; the gift is replaced if it is the damaged one | the gift goes back when what earned it goes back |

## 3 · Decisions

**The founder's (5 Oct 2026, chat) — not re-opened**
- **D1.** A deal is cancelled and returned as one; My orders shows it as one card with one Cancel and one Return. A plain discount stays per item.
- **D2.** One item of a deal not right: size / damaged / not as shown → replace that item, the deal stays, no money moves. The store's fault and it cannot replace → refund only that item's share, she keeps the rest. Changed her mind → the whole deal goes back, or she keeps it all.
- **D3.** Never one piece back at the deal's price for no reason.
- **D4.** One item of an offer can be bought alone at its normal price, with the offer shown beside it. No "alone" for buy one get one. A set stays whole unless the brand says its pieces may be sold alone. In the bag, a nudge to complete the offer.

- **D5 (5 Oct 2026, answering Q1).** "brand pays for this return": the store pays to bring a replacement and to take the other item back. The shopper is charged nothing. INFLX arranges no courier and adds no charge.

**Mine — shown to him on the board and not overruled at the lock**
- **E1.** Buy more save more counts as a deal for the card and for replacing (its items were priced together). Spend-or-buy-for-a-gift does not: its items keep their own prices.
- **E2.** A replacement is asked for inside the same return window as a return, and INFLX decides it on the same page. One replacement per item; if the replacement is wrong too, she returns (the whole deal, or that item's share when it is the store's fault).
- **E3.** For a size that doesn't fit she may choose any size of the same product that is in stock, in the same or another colour of that product. Not a different product.
- **E4.** "Damaged" and "not as shown" are the store's fault; "the size doesn't fit" is nobody's — so with no other size in stock she keeps it or returns the whole deal; there is no refund of one item's share for a size.
- **E5.** While a replacement is open, the sale's three shares wait — as they do for an open return. They are added when the replacement has been delivered and the return window, counted from that delivery, has closed.
- **E6.** The store brings the replacement and collects the other item in the same visit; INFLX does not arrange a courier. (Same as a return today: the store collects.)
- **E7.** When her bag's items from one post complete the offer, the offer applies by itself — she is not asked. (The pricing already works this way.)
- **E8.** The switch "Pieces can also be bought alone" is the brand's, per set offer, off by default, on the brand website where the offer is built. Switching it on or off never changes an order already placed.
- **E10.** After a replacement is delivered, the return window starts again from that delivery, for that deal: she can still return the whole deal, or — if the replacement itself arrives damaged or not as shown — have that item's share refunded. She cannot ask for a second replacement of the same item (E2).
- **E11.** A replacement INFLX does not accept reads "Replacement not accepted" with INFLX's note, on the deal's page. The deal stays as delivered; she may still return the whole deal while the window is open.
- **E12.** Cash on delivery: nothing differs for a replacement (no money moves). A refund of one item's share, like any return of a cash order, is sent to her by INFLX directly.
- **E9.** Photos of a damaged item are not asked for in this round (the app has no photo upload for shoppers yet); she writes a note, and INFLX may call her.

## 4 · Still open (his)
- **Q1 — answered: the brand pays (D5).**
- **Q2.** The refund-policy sentence (deferred by him on 5 Oct — a reminder is set; to be raised when this round is ready to release).

## 5 · Not in this contract
- Exchange of one item for a DIFFERENT product; store credit; partial returns for "changed my mind".
- Photo upload by the shopper.
- Picture delivery (hosting).

## 6 · Build order, once locked (proposal)
1. C — buying one item alone (phone + pricing for a set the brand opened + the brand's switch).
2. A — My orders by deal (server list + phone).
3. B — replace / refund one item (server, admin page, brand orders page, phone). The largest part; it adds a new kind of request and a ₹0 replacement parcel.
Each part is released only on his go.
