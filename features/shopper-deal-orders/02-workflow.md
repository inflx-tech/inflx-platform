# shopper-deal-orders — how it is built and what each flow does afterwards

The screens and what she sees on each are `04-preview/workflow-prediction.md`, locked with the board on 5 Oct 2026. This file says the order of building and what the server does behind each screen.

## Build order (three parts, each released only on the founder's go)

### Part C — buying one item of an offer alone (first)
1. **Server.** `offerRules.js`: a set offer's settings carry `pieces_alone` (off unless the brand switched it on); `aloneAllowed(offer)` says whether a product of the offer may be bought alone — yes for a bundle (pick any, mix & match), buy more save more and both gift offers; no for buy one get one; a set only with the brand's switch. `orderPricing.service.js`: a piece of an opened set outside a whole set pays its normal price and no longer blocks the bag; every priced group says `offer.alone` and, when it has items outside a completed deal, the sentence that nudges her to complete it (`alone_nudge`). `shopperOrders.service.js` (the deal data) and `shopperPosts.service.js` (the post card) say `buy_alone`. Tests: `backend/tests/shopper-deal-orders.test.js`.
2. **Phone (shopper app only).** The product page (B1–B3), "Products in this post" and the size sheet (B4), the bag (B5, B6), Saved (C7), words in `copyOrder.js`.
3. **Brand website.** The offer builder's Numbers step for Bundle · Fixed: the switch "Pieces can also be bought alone" (B7); the offer's page says how it was set.
4. **Rules.** `Docs/OFFER_TERMS_POSTS_RULES.md` v1.19: §6.3, §6.4, §6.5, §6.6.
5. Whole phone suite, whole server suite, before/after notes. Release on his go: push (server + website), then the shopper app update. **No migration.**

### Part A — My orders by deal (second)
Server: My orders answers cards — one per deal (`transaction` + `deal_key` of a set, a pair, or a buy-more deal), one per item otherwise — and a deal's page (its items, one timeline, what was paid for the deal). Cancelling is the existing cancel, entered once for the deal. Phone: O1–O4. **No migration expected.**

### Part B — replace one item, or refund its share (third; the largest)
Server: a request has a kind — return (today's), replace, refund one item; a replacement is a ₹0 parcel the brand sends and marks delivered; stock moves for the item going out and the one coming back; the sale's three shares wait while a replacement is open (E5); the return window restarts from the replacement's delivery (E10). Admin › Returns decides all three kinds (R10); the brand's Order Fulfillment shows "Replacement to send" (R9); the shopper screens R1–R8. **One migration** (the kind of a request, what replaces what, the replacement parcel).

## The flows of part C, as they are afterwards

**The product page of an offer post (B1–B3).**
- Bundle, buy more save more, a gift offer, or a set the brand opened: "Buy this alone · ₹1,999" over **Buy now** and **Add to bag** (at the normal price), and under them "In an offer: Any 3 for ₹2,999 · See offer ›". See offer opens the deal page with this product started.
- Buy one get one: the line "Buy one, get one free. Pick your free one next." and one button, **Get this offer** (the deal page with this product started).
- A set the brand has not opened: the line "Sold as a set." and **Build your deal**, as today.
- A plain discount or a price post: unchanged.

**Products in this post (B4).** On an offer post whose products can be bought alone, the bag icon on a product opens the size sheet: colour, size, the normal price, Buy now, Add to bag, and under them "Or get it in the offer: Any 3 for ₹2,999 ›". "Build your deal" stays at the foot. On a buy-one-get-one post, or a set the brand has not opened, the bag icon opens the deal page as today.

**The bag (B5, B6).**
- An item bought alone is an ordinary row (− 1 +, Change, Remove, Move to Saved) at its normal price. Under the post's items: the nudge the server wrote ("Add 2 more from this post and get all 3 for ₹2,999") with "See offer ›", which opens the deal page with what she has from that post already in it.
- When her ticked items from one post complete the offer, the server prices them as the deal: they show as one deal (one tick, Edit deal, Remove deal, the deal's price with the normal total struck). If she added one of them alone since the app opened, the green line "The offer applied by itself." is under it.
- More than the deal needs (4 items of "any 3"): the three costliest are the deal; the fourth is an ordinary row under it at its normal price, with the nudge to complete another.
- Taking an item out, or unticking it, un-applies the offer the same way: what is left is priced again by the server.

**Saved (C7).** Tapping a saved product that can still be bought opens its product page (the page above). "Open post ›" stays.

**The brand (B7).** Building a Bundle · Fixed offer, the Numbers step has the switch "Pieces can also be bought alone", off to begin with. Like every number of an offer it can change only while the offer is a draft; once published it reads as it was set.

## What does NOT change in part C
What a deal costs, how a deal is built on its deal page, checkout, payment, cancelling, returning, commission and INFLX's share (an item bought alone is an ordinary sale through that post: the creator earns her collaboration % on it), the creator and brand apps, the admin.
