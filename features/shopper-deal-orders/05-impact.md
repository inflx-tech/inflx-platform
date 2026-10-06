# shopper-deal-orders — impact

**Verdict.** Production-impacting, in three releases. Part C (buying one item alone): server, shopper app and one switch on the brand website — no migration, no money rule changes. Part A (My orders by deal): server and shopper app — no migration, no money moves. Part B (replace one item / refund its share): the large one — one migration, and it touches refunds, stock and when a sale's shares are paid.

## Part C — buying one item of an offer alone

### Who notices what
| Who | Changes |
|---|---|
| Shopper | On an offer post she can buy one product at its normal price (product page, the bag icon in "Products in this post"); the offer is shown beside it. In the bag a lone item is an ordinary row with a nudge to complete the offer; when her items complete it, the offer applies by itself. A saved product opens its product page. |
| Brand | One new switch on a Bundle · Fixed offer while it is a draft: "Pieces can also be bought alone" (off). Its other offers behave as before, except that a product of a bundle / buy-more / gift offer can now also sell alone at its normal price. |
| Creator | Nothing on her screens. A product bought alone from her offer post is a sale through her post: she earns her collaboration % on it, as on any sale. |
| INFLX admin | Nothing. |

### Server
| Change | Risk |
|---|---|
| A set's settings keep `pieces_alone` (missing = off) | Every set offer that exists today stays "sold only whole" |
| A piece of an opened set outside a whole set pays its normal price and no longer blocks the bag | Only for offers whose brand switched it on |
| Additive fields: `buy_alone` on the deal data and the post card, `offer.alone` and `alone_nudge` on a priced group | Older app versions ignore them and keep "Build your deal" |
| No change to what any deal costs | The engine's deal cases are untouched; a single bundle item already paid its normal price — the phone simply never let her add one |

### Phone (shopper app only)
`ProductScreen`, `bitsShop` (Products in this post), `orderBits` (size sheet), `BagScreen`, `SavedScreen`, `copyOrder`, `bag.js`. With an older server the new app falls back to today's behaviour (no `buy_alone` → "Build your deal").

### Brand website
`components/offers/NumbersPanel.js` (the switch), `OfferPage.js` (how it was set).

### What can go wrong, and the undo
- The bag is the one screen with real new logic (which rows are the deal, which are ordinary). Every price on it is still the server's. Undo: publish the previous shopper bundle (235); revert the commit and push.
- A brand cannot switch a published set: the switch is one of the offer's numbers and those are frozen at publish (rules 1.x). To open a set already live, the brand makes a new offer.

## Part A — My orders by deal (when built)
Server: the list and the details are read-only views over the same order lines (grouped by the deal they were priced in). Cancelling a deal is today's cancel. No migration, no money moves, nothing for the brand, creator or admin.

## Part B — one item of a deal is replaced, or its share refunded (written 5 Oct 2026, before building)

**Verdict.** Production-impacting, the largest of the three: one additive database change, the server, the shopper app, the brand website (Order Fulfillment, Returns) and the admin (Returns). It touches refunds, stock and the moment a sale's money is released — but only for an order on which a replacement or a one-item refund is asked. Every other order, and a return of a whole deal, behaves exactly as today.

### Who notices what
| Who | Changes |
|---|---|
| Shopper | A delivered deal's button reads "Return or replace". It asks first: **One item is not right** or **Return the whole deal**. One item → which one, and what is wrong (size · damaged · not as shown) → another size, or the same item again, or — damaged / not as shown and the store has no more — a refund of that item's share. Then a box on the deal's page: Replacement requested → approved → Replaced (or not accepted, with INFLX's note). |
| INFLX admin | Returns lists three kinds, each named: **Return** (as today) · **Replace** · **Refund one item**. Approve and Reject as today. A replacement needs nothing more from the admin; a one-item refund is marked refunded when the item is back, like a return. |
| Brand | Order Fulfillment shows **Replacement to send**: which item goes out, which comes back, to whom → Mark sent → Mark delivered. Nothing is added to or taken from its wallet. The brand pays for bringing it and taking the other back (the founder's D5). Its Returns page names the kind. |
| Creator | Nothing on her screens. Her commission on that sale waits a little longer (below). |

### The database (one migration, additive — nothing existing is rewritten)
- The returns table: the **kind** of a request (return · replace · refund one item; every existing row is a return), what the item is replaced **with** (colour, size), and where the replacement is (to send · sent · delivered, with the times). One new state, **replaced**.
- A sale: **when its return window runs from again** — empty for every sale that never had a replacement.
- An order's items: nothing new. (An item of two where one is replaced is split into two items of one; the money on them adds up to what it was.)

### The money, case by case
| Case | What moves |
|---|---|
| Replacement (another size, or the same item again) | **Nothing.** The deal stays; what she paid, the creator's commission, INFLX's share and the brand's share are untouched. |
| While a replacement or a one-item refund is open | The sale's three shares **wait**, exactly as they wait for an open return today (the two money jobs already skip a sale with an open request). |
| After the replacement is delivered | The return window **runs again from that delivery** for that sale (everything she bought from that post in that order); the three shares are added when it closes. So the creator and the brand are paid up to one window later than without the replacement. |
| Refund of one item's share (the store's fault, it cannot replace) | That item is undone exactly as a return undoes an item today: its share (what that item carried of the deal's price when she ordered) goes back to her — to her payment method, or sent by INFLX when she paid cash; the creator's commission on it leaves her pending earnings; INFLX's share on it is not taken; the brand is not paid for it. The other items of the deal are untouched. |
| A replacement INFLX does not accept | Nothing. The deal stays as delivered; she may still return the whole deal while the window is open. |

### Stock
- A replacement's item is **taken from stock when INFLX approves** (not when she asks). If it sold out meanwhile, the approval is refused with that reason and INFLX rejects it or she asks again.
- The item that comes back **returns to stock only when the reason was the size**. A damaged item, or one that is not as shown, is not put back on sale.

### What can go wrong, and the undo
- **The two money jobs** each get one changed line (the window's start is the later of the delivery and the replacement's delivery). For a sale with no replacement the value is the delivery, as today. Their existing tests must pass unchanged.
- **Return eligibility** ("can she still return this?") now reads the kind of her last request: a replacement that was done, or not accepted, no longer blocks returning the whole deal. A return that was not accepted still blocks, as today.
- **An item of two** is split in two before a request is recorded. The split is money-neutral (the parts add up, to the paisa) and is kept even if the request is refused.
- Undo: revert the commit and push; publish the previous shopper bundle (237). The migration is additive and can stay; no existing row is changed by it.

### Built as decided — the founder's rules and my notes he did not overrule
D2, D3, D5 (the brand pays; no charge to the shopper), E2 (one replacement per item, inside the return window, decided by INFLX), E3 (any size of the same product in stock, same or another colour), E4 (a size with no other size in stock: keep it or return the deal — no one-item refund for a size), E5 (shares wait), E6 (the store brings and collects in one visit; INFLX arranges no courier), E9 (no photo upload; a note), E10 (the window runs again after a replacement), E11 (not accepted → the deal stays), E12 (cash: the refund is sent by INFLX).

### Not in this build
- **A damaged free gift being replaced** (one cell of the board's table). No screen was drawn for it and a gift has no page of choices today; it would be a small follow-up.
- Buy one get one: one item of a pair can be **replaced**; when the store cannot replace it, the pair goes back together (the table's rule) — there is no one-item refund for a pair.
- Plain-discount items, and an item bought alone: returned on their own, as today (no replacement).

## Not covered
- Nothing of this round has been seen on a phone until the founder walks it.
- The refund-policy sentence (Q2) is his and still open.
