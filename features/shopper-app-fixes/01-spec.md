# shopper-app-fixes — fifteen faults and eight small ones in the shopper app

**Status:** approved by the founder, 5 Oct 2026 (chat: "Fix all 15 issues first as well as 8 small other issues… then we go for design round issues"). The list is the one given to him on 4 Oct after a read-through of every shopper screen; each fault was confirmed in the code on both ends before it was listed.
**Not in this contract (the design round that follows, his decisions of 5 Oct):** My orders by deal with one Cancel / Return; replacing one item of a bundle; buying one item of an offer alone. Also not here: picture delivery (hosting), the add-product form.
**Rules touched:** `Docs/OFFER_TERMS_POSTS_RULES.md` §5 (shopper app) and §6 (ordering). No rule changes — the app is made to do what the rules already say. One sentence of the in-app refund policy is corrected to match rule 6.12 (N8).

## 1 · The fifteen faults

| ID | Today | After | Where |
|---|---|---|---|
| F1 | She cancels an online payment, or it fails, and is told "Nothing was charged" — but her bag is already empty, and the items stay held for 15 minutes so her own retry can read "Sold out". | The bag is emptied only when the order is really placed (cash: at Place order; online: when the payment arrives). Cancelling or failing the payment releases the held items at once. If a payment lands after the items were released and they have sold out meanwhile, she is told "It sold out while you were paying. Your payment is being refunded." — never "Order placed". | server + phone |
| F2 | A mobile number that starts with 91 cannot sign in ("phone must be a valid Indian mobile number"). | The ten digits she types are always sent as +91 and those ten digits. | phone |
| F3 | After about 15 minutes a signed-in shopper is silently treated as a guest on the pages a guest may also see: her likes, saves and follows look empty and Comments asks her to sign in. | The app renews her session before a request when it has run out, so she stays herself everywhere. If the session cannot be renewed because she was signed out elsewhere, she becomes a guest quietly (no "Session expired"). | phone |
| F4 | Every new shopper is named "Follower" on her profile and her comments. She is never asked her name. | A new shopper is asked "Your name" once, right after the code. A shopper already named "Follower" is asked at her next sign-in, and her Profile shows "Add your name". A comment by someone who has given no name reads "INFLX shopper". | phone + server |
| F5 | Play starts again from the first video of a fresh list every time she comes back to it (from comments, a store, the bag, a product page), and the video she tapped is no longer first. | Coming back to Play, she is on the video she left. | phone |
| F6 | A product that has sold out in every size still looks in stock: its tile has the bag icon, its size sheet shows every size crossed out with no words, and its post never leaves the shop. | It reads "Out of stock", the size sheet says "Sold out in every size", and a post whose products have all sold out leaves the shop, as rule 5 says. | server + phone |
| F7 | After signing in from Comments she lands back on Comments still reading "Sign in to like and comment". | Comments shows her as signed in, with the box to write. | phone |
| F8 | Opening a video from a store, search, a post's page or an offer's posts throws away where she was: Back goes to Home. | The video opens on top with a Back arrow; Back returns her to where she was. From a main tab (Home, Saved) it opens in the Play tab as now. | phone |
| F9 | The bag icon shows no number after the app is reopened until she opens the bag. A bag that could not be read is shown as "Your bag is empty", and adding something then can wipe what she had. | The count is read once when the app opens. A bag that could not be read says "Couldn't load your bag" with Try again, and nothing is added or saved over it. | phone |
| F10 | For a size that has its own price, the product page and the size sheet show the product's base price; the bag then says "Price changed from ₹…". | Choosing a size shows that size's price (after the offer, as the server works it out). No false "Price changed". | server + phone |
| F11 | Her choices on Welcome ("Show my feed") do not change the feed until she pulls to refresh. If Welcome cannot load it spins for ever with no way out. | The feed reloads with her choices when she returns. A Welcome that cannot load says so, with Try again and Skip. | phone |
| F12 | On "Your deal", removing the only item leaves a spinner for ever; an item removed there is back when she taps Change. | Removing the last item returns her to the deal page with nothing picked. A removal on the review is a removal on the deal page too. | phone |
| F13 | Profile: Orders reads "No orders yet" while her orders are packed, out for delivery or delivered. Returns reads "Coming next" though Return is live. Following does nothing. | Orders reads "2 on the way" (anything not yet delivered), else "3 orders", else "No orders yet". Returns reads "Return an item from My orders" and opens My orders. Following opens the list of creators she follows; each opens that creator's store. "1 creator", not "1 creators". | server + phone |
| F14 | A like, a bookmark or a heart she has just given looks undone on the next screen. In a product collection a signed-in shopper never sees her hearts. A saved product whose post has ended can never be removed from Saved. | What she liked, saved or hearted stays so on every screen until she undoes it. Collections show her hearts. Every saved product has "Remove". | phone + server |
| F15 | Tapping a notification only opens Home. There is no list of notifications in the app. A phone she has just signed in on is not registered for notifications until the next launch. | Tapping an order or return notification opens that order. Profile has "Notifications" with the latest fifty, newest first; tapping one opens its order. The phone is registered for notifications at sign-in. | phone + server |

## 2 · The eight small ones

| ID | Today | After | Where |
|---|---|---|---|
| N1 | A post that has ended says "Couldn't load. Check your connection." on the products sheet, the deal page and the product page. A real failed load has no Try again. | An ended post says the server's own sentence ("This post is no longer in the shop"). A failed load has Try again. | phone |
| N2 | The sign-in screen always says "to like and comment", even when she came from "Sign in to place your order". There is no "Resend code". | The line says why she is signing in (order, like and comment, save, follow). "Resend code" appears after 30 seconds. | phone |
| N3 | Order details reads "Paid ₹X · Cash on delivery" before the parcel is delivered. | "To pay ₹X on delivery" until it is delivered; "Paid ₹X · Cash on delivery" after. | phone |
| N4 | My orders reads "No orders yet" when a filter or a search simply has no match; there is no Packed or Out for delivery filter. | "Nothing matches" (with what she searched or filtered), and the two filters are added. | phone |
| N5 | Creator store, brand store, offer posts, My orders and Comments stop at the first 20 (comments 30). | The next ones load as she reaches the end of the list. | phone |
| N6 | In the bag a chosen free gift appears twice (a row and the green "Free gift" line). "Delivery · Free" is written into the app. | The gift appears once, as its own green "Free gift" row. The bag no longer writes a delivery line at all (the server sends no delivery amount with a bag); Review order shows the server's amount ("Free" only when it is 0). | phone |
| N7 | A deal card reads "₹999 · " for a product with no sizes and "1 sizes" for one size. A shared post or a code match can show the internal titles "Price post" / "Untitled post". | "₹999", "1 size". A post with no caption is titled by its first product ("Blue polo and 2 more"). | phone + server |
| N8 | The refund policy in the app says cancelling needs no reason; Cancel requires one (rule 6.12). A collection says each product "sells like a one-product post" directly above "To buy one, open it from a creator's post". | The collection keeps only the sentence that is true (done). **The policy sentence is NOT changed — see X9.** | phone |

## 3 · Decisions

**The founder's (5 Oct 2026):** fix all fifteen and the eight; the design items wait for their own round.

**Mine, under his standing "take your best decision" (each can be reversed):**
- **X1.** F3 is fixed on the phone (renew before asking), not by making the server refuse an expired guest-allowed request: the website and the other two apps use the same server pages and must not start seeing refusals.
- **X2.** F4 asks for a name with one box and Continue; it is required (a comment needs a name). An existing "Follower" is asked at her next sign-in, not interrupted mid-use.
- **X3.** F6 keeps the product's own stock number equal to the sum of its sizes whenever stock moves, so everything that already reads that number (the feed, the tile, the post leaving the shop) is right without each being rewritten; the tile's in-stock flag is also worked out from the sizes directly.
- **X4.** F8's Back arrow is the only new control on Play. F13's Following list and F15's Notifications list are plain lists in the app's existing row style — no new look.
- **X5.** F15: a notification about an order opens that order's details; one about a placed order opens My orders. Any other opens Profile › Notifications.
- **X6.** N5 loads more by reaching the end of the list (no "Load more" button), as the feed does.
- **X7.** N8 changes one sentence of the in-app refund policy so it stops contradicting the app. The website's copy of the policy is not touched here.
- **X9 (found while building — the founder's call).** The refund policy inside the app is not text of its own: it is produced from the website's policy (`Packages/brand-web/lib/legal/docs-commerce.js` → `scripts/sync-legal-to-mobile.mjs`), and a check fails if the two differ. So the sentence "you do not have to give a reason" can only be corrected by changing the website's policy too. That is legal text and it is left as it is until he says which should change — the policy's sentence, or the app asking for a reason.
- **X10 (added while building, same fault F1).** When she HAS paid but the app cannot reach INFLX to confirm it, that is not a failed payment: the app tries three times, releases nothing, and says "We couldn't confirm your payment yet. Please don't pay again." with "Check again" and "My orders" — there is no Place order until it is settled. (Releasing the items and saying "the payment didn't go through" would invite her to pay twice.)
- **X11 (two small completions).** F2: the number box takes a pasted "+91 98765 43210" (its last ten digits are the number). N1: Comments on a post that has ended also says the server's sentence.
- **X8.** A small board is drawn for the record of what changes on screen; it is locked under the founder's instruction to fix these, not by a separate review — nothing on it is a new design.

## 4 · Not in this contract
- The three design items (My orders by deal, replace one item, buy one item alone).
- The brand and creator sign-in (checked: F2's slip is only in the shopper sign-in).
- Paging of Search results; a count of unread notifications on the Profile row.
