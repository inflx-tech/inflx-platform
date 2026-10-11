# Workflow Definition — Listing and shop safety: four fixes

> Each numbered step becomes an assertion. Words in quotes are what a screen says.

## Actors
- **Brand** — signed in on the website, on Listings.
- **Creator** — the creator app, with an approved post.
- **Shopper** — the shopper app.

## Preconditions
A brand with products in a live offer; a creator with approved posts on them, one of which carries a
single product; a set offer with one live post.

## A · Hide and out of stock are a pause
1. The brand taps **Hide** on a product that is the only product of a live post → the product is
   not in the shop; that post is not in the shop; the post is still "approved" and still holds the
   product.
2. The creator is told "{product} is not on sale right now". Opening that post she reads "Not in
   the shop right now" and why.
3. The brand taps **Show** → the product and the post are in the shop again, exactly as before.
   The creator is told "{product} is back on sale".
4. The brand hides one of three products of a post → the post stays in the shop with the other
   two; its price band is worked out from those two. Show brings the third back.
5. The brand saves a product with every size at **0** → nothing is removed; a post whose products
   are all at 0 is not in the shop. Saving stock above 0 brings it back.
6. The product panel reads "Given to 2 creators · in 3 of their posts" — the true numbers.
7. The brand taps **Remove** → it is asked first: "{name} is in 3 live posts. It will be taken out
   of them for good. 1 post has nothing else and will be removed. This can't be undone." On OK the
   product is hidden and gone from the posts; the one-product post is removed and its creator told.
8. The brand taps **Remove** on a piece of a running set → refused: "{name} is part of the set
   "{offer}". Hide it to pause the set, or end the offer first." Nothing changes.

## B · Saving Edit never brings back sold stock
9. The brand opens Edit; Blue · M shows 3. A shopper buys 2. The brand changes only the
   description and saves → Blue · M is **1**, not 3. The page says "While you were editing, 2 of
   Blue · M were sold. Its stock is now 1."
10. Same start; the brand changes M from 3 to 10 (7 more arrived) and saves → **8**, and the page
    says so.
11. The brand empties a box → that size is not counted. The brand types a number in a box that was
    not counted → that number.
12. Nothing sold in between → every number is saved exactly as typed, with no message.

## C · Place order happens once
13. Cash on delivery: the shopper taps Place order; the answer is lost; she taps again → **one**
    order. Her second tap gets the same "order placed" answer.
14. Online: her first tap holds the items and the answer is lost; she taps again → the same held
    order comes back and the payment sheet opens for it. Nothing is held twice; she is not told
    "Sold out" by her own hold.
15. She changes the address or the way to pay and places again → a new order attempt, as today.
16. An attempt whose hold ran out or whose payment she closed → placing again starts afresh.

## D · A set is in the shop only while it can be bought
17. One piece of the set is hidden, or sells out → the set's post is not in the shop. Her bag line
    for it says it is not available.
18. The piece is shown again, or restocked → the post is back, by itself.
19. A set whose pieces may be bought alone, with one piece sold out → the post stays; the other
    pieces are bought at their normal price.
20. A set needing 2 T-shirts and 1 jeans → she taps the T-shirt, chooses a colour and size once, and
    the page counts both; with the jeans chosen the set is complete at the set's price.

## Success definition
- Nothing a brand can undo with one tap destroys a creator's post.
- Stock on the website can only move by what the brand typed, never back to an old number.
- One tap on Place order, however many times it is repeated, makes one order.
- A set is either buyable or not in the shop.

## Failure / edge workflows
- An old copy of the Edit page (sends no "shown" numbers) → saved as before.
- An old shopper app (sends no key) → Place order as before.
- Remove refused → no change at all, and the reason is shown.
- A post removed before this change stays removed.
