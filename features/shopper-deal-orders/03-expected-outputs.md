# shopper-deal-orders — expected outputs

Each row is proved by a test (named in the last column) or is owed to the founder's walk. Parts A and B get their rows when they are built.

## Part C — buying one item of an offer alone

### Server (`backend/tests/shopper-deal-orders.test.js`)
| ID | Given | Then |
|---|---|---|
| CS1 | A set offer's settings without `pieces_alone`, or with anything but `true` | normalised to `pieces_alone: false` |
| CS2 | `aloneAllowed` for each kind of offer | bundle pick any / mix & match, buy more save more (quantity, value), gift (spend, buy X): yes · buy one get one: no · set: only with `pieces_alone` · plain discount: yes (each item already stands alone) |
| CS3 | One item of "Any 3 for ₹2,999" in a group | pays its normal price, the group is buyable, `offer.alone` true, `alone_nudge` "Add 2 more from this post and get all 3 for ₹2,999" |
| CS4 | Three items of that bundle | one set at ₹2,999, shared by normal price; `alone_nudge` null |
| CS5 | Four items | the three costliest are the set; the fourth pays its normal price with no deal key; `alone_nudge` "Add 2 more to complete another set of 3 for ₹2,999" |
| CS6 | One piece of a set the brand has NOT opened | "Sold only as the whole set", not buyable (as today); `offer.alone` false |
| CS7 | One piece of a set the brand opened | pays its normal price, buyable, no problem; `alone_nudge` names the whole set and its price |
| CS8 | Every piece of an opened set, plus one more of one piece | one whole set at the set's price; the extra piece pays its normal price |
| CS9 | Buy one get one, one paid unit and no free one | as today (pays one, the pair is asked for); `offer.alone` false |
| CS10 | The deal data and the post card of each kind of post | `buy_alone` as CS2 on a deal post; false on a discount or price post (no deal page there) |
| CS11 | Review order (Buy now) with one item of a bundle post | priced at its normal price; the order's line has no deal key and the creator's share is her % of that price |
| CS12 | A brand saves a draft Bundle · Fixed with `pieces_alone: true`, then publishes | the published offer keeps it; the shopper's sentence for the set adds that a piece can also be bought alone |
| CS13 | The deal data of a deal post | every product and every size says `alone_price`: what ONE unit costs bought on its own, asked of the price engine itself — the normal price for a bundle, a set, buy one get one and a gift offer; the first step's price when a buy-more ladder starts at "buy 1" (₹699 → ₹629 at 10%). The bag, asked for that one unit, charges the same amount. Not sent on a plain discount post |

### Phone (shopper app)
| ID | Screen | Then | Test |
|---|---|---|---|
| CP1 | Product page, bundle post (B1) | "Buy this alone · ₹1,999", Buy now, Add to bag, and "In an offer: Any 3 for ₹2,999 · See offer ›"; no "Build your deal" | `shopperDealOrdersAlone.test.js` |
| CP2 | — Add to bag | the bag gets that one line (colour, size, qty 1, the size's price) | same |
| CP3 | — See offer › | the deal page takes this page's place with the product started | same |
| CP4 | Product page, buy-one-get-one post (B2) | the line "Buy one, get one free. Pick your free one next." and one button "Get this offer"; no Add to bag | same |
| CP5 | Product page, set post (B3) | "Sold as a set." and "Build your deal"; with the brand's switch on: the two choices of CP1 | same |
| CP6 | Product page with an older server (no `buy_alone`) | today's "Build your deal" | same |
| CP7 | Products in this post, bundle post (B4) | the bag icon opens the size sheet (not the deal page); the sheet has Buy now, Add to bag and "Or get it in the offer: Any 3 for ₹2,999 ›", which opens the deal page with that product started; "Build your deal" is still at the foot | `shopperDealOrdersAlone.test.js` |
| CP8 | Products in this post, buy-one-get-one or unopened set | the bag icon opens the deal page, as today | same |
| CP9 | Bag, one item of a bundle (B5) | an ordinary row: tick, − 1 +, Change, Remove, Move to Saved, ₹1,999; the server's nudge with "See offer ›" (opens the deal page with her items); no "Edit deal" in the header | `shopperDealOrdersBag.test.js` |
| CP10 | Bag, the three complete the bundle (B6) | one deal: one tick, Edit deal, the three items with nothing to press, "Set complete… · ₹2,999" with ₹4,797 struck, Remove deal; "The offer applied by itself." when one of them was added alone in this session, not otherwise | same |
| CP11 | Bag, four items of "any 3" | the deal block holds the three the server put in the set; the fourth is an ordinary row under it; Remove deal takes out the three only | same |
| CP12 | Bag, buy one get one, or an unopened set | exactly as before (one whole group) | the existing bag tests |
| CP13 | Saved, a product that can still be bought (C7) | tapping it opens its product page; "Open post ›" still opens the post | `shopperDealOrdersAlone.test.js` |
| CP14 | "Buy this alone · ₹X", the price above it, and the size sheet's price | the server's `alone_price` (the chosen size's; the product's before a size is chosen), with the normal price struck when it is lower; the bag is still told the size's normal price; a server that sends none: the price shown before | same |

### Brand website
| ID | Then | Proof |
|---|---|---|
| CW1 | The Numbers step of a draft Bundle · Fixed has the switch "Pieces can also be bought alone", off; switching it saves `pieces_alone` with the offer's numbers | seen in the local preview, 5 Oct 2026 (06-diff/notes.md) |
| CW2 | A published set's page says whether its pieces can be bought alone | seen in the local preview, 5 Oct 2026 |

### Tests moved to the new rule (drift, not weakened)
| Test | Was | Now | Why |
|---|---|---|---|
| `backend/tests/shopper-walk-fixes-returns.test.js` › "one request; the item says Return requested…" | the brand's parcel item says `return: { status, word }` | `{ status, kind: 'return', word }` | Part B: the brand is told which kind of request is open on a parcel. The assertion still names every field; a return is still "Return requested". |
| `backend/tests/shopper-deal-orders-orders.test.js` (part A's own) › "every item on a card says…" | a card's item has nine fields | ten: `state` added (null unless that item went back or was cancelled while the rest stays) | Part B: one item of a deal can go back alone. The test still lists every field exactly. |
| `backend/tests/offers-v2-rules.test.js` › "stray fields are dropped; blanks stay null" | a set's numbers normalise to `{ price, quantities }` | `{ price, quantities, pieces_alone: false }` | The set has one more number (C3). The assertion is as strict as before: it still names every field, and now also proves that a missing switch is off. |

### Owed to the founder's walk
B1–B6 on a phone with a real bundle post; B7 on the website.

## Part A — My orders shows a deal as one (written before the build; not built yet)

### Server (`backend/tests/shopper-deal-orders-orders.test.js`)
| ID | Given | Then |
|---|---|---|
| AS1 | She ordered a bundle ("any 3"), a buy-one-get-one pair and a plain-discount item | `GET /follower/orders?by=deal` answers three cards: the bundle (its three items, the deal's words, one status, what the deal cost), the pair (the paid one and the free one), the single item on its own |
| AS2 | The same orders, asked the old way (no `by=deal`) | every item on its own, exactly as before — an app not yet updated loses nothing |
| AS3 | A buy-more-save-more order that reached a tier | one card for the items the saving applied to |
| AS4 | A gift offer's order | each item its own card, and the gift its own, as today — no card is a "deal"; the gift still follows what earned it when that is cancelled |
| AS5 | 25 cards, one of them a deal whose items would straddle a page of 20 | page 1 has 20 whole cards, page 2 the rest; no deal is split and no card repeats |
| AS6 | A filter (Cancelled, Returned, Delivered…) or a search for one item's name | the whole deal's card when any of its items matches |
| AS7 | Order details asked for any item of a deal | the deal: its words, every item with colour and size, what was paid for the deal, one timeline, and one `can_cancel` / `can_return` for the deal |
| AS8 | Cancel preview asked for any item of a deal | the deal's words, who it is from, every item, one refund for the whole deal, the same reasons; cancelling cancels them together and refunds the deal (unchanged) |
| AS9 | An item bought alone from a bundle post (part C) | a card of its own |

### Phone
| ID | Screen | Then |
|---|---|---|
| AP1 | My orders (O1) | a deal is one card: status and date, the deal's words, its items (the free one of a pair says Free), the brand and the deal's price; a single item keeps its own card with its price (the normal price struck when it cost less) |
| AP2 | — a tap | opens the deal's page |
| AP3 | The deal's page before it ships (O2) | who it is from and the deal's words, every item, "Paid ₹2,999 · UPI, cards, net banking", one timeline, the address, the post, and one button, "Cancel deal" |
| AP4 | Cancel deal (O3) | the deal's words, its items, the reasons, "Refund of ₹2,999 to your original payment method in 5–7 working days", the button "Cancel deal"; no "This is part of a deal" warning |
| AP5 | The deal's page after delivery (O4) | one button to return, with until when. It reads "Return deal" until part B is built, then "Return or replace" |
| AP6 | With an older server (no cards in the answer) | every item on its own, as today |

## Part B — one item of a deal is replaced, or its share refunded

### Server (`backend/tests/shopper-deal-orders-replace.test.js`, 20 tests)
| ID | Given | Then |
|---|---|---|
| BS1 | "Return or replace" asked for a delivered bundle | the deal, until when, three reasons, every item with its sizes (the one she has; which are in stock), whether the same item is in stock, its share, and the whole-deal return |
| BS2 | She asks for another size | a request of kind `replace` (from 32 to 34, ₹0); nothing taken from stock yet; her deal says "Replacement requested" on its page and card; the brand has nothing to send yet and its parcel says "Replacement requested" |
| BS3 | INFLX approves | the 34 is taken from stock; the brand's list has it "To send" (send / collect / to whom / the deal / "nothing is added to or taken from your wallet"); "Mark refunded" is refused; another brand cannot see or move it |
| BS4 | The brand marks it sent, then delivered | only in that order; her item is now the 34; the 32 is back in stock; the request ends "Replaced"; the item's and the sale's money are exactly what they were |
| BS5 | After the replacement is delivered | the return window runs again from that delivery: she can still return the deal; the settlement service refuses the sale; the wallet says the new day; both money jobs hold it — and release it when the new window has closed |
| — | An open replacement, the sale's own window long closed | the sale's money is held; once INFLX says no it is released |
| BS6 | An item replaced once | no second replacement; a size → keep it or return the deal; damaged → its share |
| BS7 | Damaged / not as shown, the store has one | the same item again; a note is required; what comes back is NOT put back on sale |
| BS8 | Damaged, the store has no more | only that item's share is refunded (online: to her payment); the other two are untouched to the paisa; exactly that item's three shares are undone; the deal shows one item "returned"; the rest can still go back together |
| BS9 | Her screen showed "replace" and the stock moved | refused ("This changed while you were choosing"), nothing recorded |
| BS10 | A buy-one-get-one pair | either item can be replaced; no one-item refund — the pair goes back together |
| BS11 | INFLX does not accept | she is told why; that item has had its answer; the other items can still be asked about; the whole deal can still be returned |
| BS12 | Before delivery · after the window · an item in no deal · another shopper · a second request | each refused with its own sentence |
| BS13 | Two of one item, one not right | it becomes its own item first; the two parts add up to what the item was, to the paisa; the request is for the one |
| BS14 | INFLX's Returns list, the brand's Returns list | each request names its kind; a replacement says what is swapped and the deal; a whole-deal return is kind "return" |
| BS15 | The replacement sold out before INFLX approved | the request closes itself, she is told, and she may choose again |
| E12 | Cash on delivery, one-item refund | paid back by INFLX by hand |

### Phone (`shopperDealOrdersReplace.test.js`, 34 tests)
R1 the two choices and until when · R2 which item and what is wrong (three reasons, never "I changed my mind"; an item that had its answer cannot be chosen) · R3 another size (the one she has and a sold-out one cannot be chosen; another colour) · R7 no other size, and "already replaced once" · R4 the same item again, with her words · R5 its share refunded, what she keeps · a pair goes back together · the stock moved while she chose (said, read again, choose again) · O4 the deal's button "Return or replace" · R8 the box by kind and state · the same words on the card.

### Web (seen in the local preview on a private database, 5 Oct 2026)
| ID | Then |
|---|---|
| BW1 | Admin › Returns has a Type column — Replace ("Indigo · 32 → Indigo · 34", the deal, "No money moves"), Return (each item, "3 items together"), Refund one item ("Refund ₹918") — and a Replaced tab |
| BW2 | Approve on a replacement says what it does; after it, the Approved tab reads "The store has it to send" with no "Mark Refunded" |
| BW3 | Brand › Order Fulfillment shows "Replacement to send" (Send · Collect · To · Why), Mark sent → Mark delivered, then "Replacement delivered"; the order's row says which kind of request is open |
| BW4 | Brand › Returns names the kind of each request |
