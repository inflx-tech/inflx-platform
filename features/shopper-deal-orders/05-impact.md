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

## Part B — replace / refund one item (when built)
One migration (kind of request; what replaces what; the replacement parcel). Touches: the return request and its decision (admin), stock out and back, a ₹0 parcel on the brand's Orders page, the refund of one item's share (online: to her payment method; cash: sent by INFLX), and the moment the sale's three shares are added (they wait while a replacement is open, then count from the replacement's delivery). The brand pays to bring the replacement and take the other item back (D5); nothing is added to or taken from its wallet for a replacement. This part gets its own detailed impact note before it is built.

## Not covered
- Nothing of this round has been seen on a phone until the founder walks it.
- The refund-policy sentence (Q2) is his and still open.
