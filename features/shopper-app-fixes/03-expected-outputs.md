# shopper-app-fixes — expected results

"Proved by" names the automated check. **A device walk is owed for every phone row** — nothing here has been seen on a phone.

## A · Server
| # | Expected | Proved by | Status |
|---|---|---|---|
| A1 | F1 · Online: Place order holds the item and leaves her bag; cancelling releases the item at once (only her own checkout; twice changes nothing); her retry is not told "Sold out" | `backend/tests/shopper-app-fixes.test.js` · F1 | pass |
| A2 | F1 · Paid: the order is placed and only then does what she ordered leave her bag; an unticked item stays | same | pass |
| A3 | F1 · A payment that arrives after she cancelled takes the item again and places the order | same | pass |
| A4 | F1 · …and when the last one has gone meanwhile: nothing is ordered, she is refunded, her bag stays | same | pass |
| A5 | F1 · Cash on delivery: the bag is emptied at Place order; "abandon" changes nothing | same | pass |
| A6 | F6 · Buying the last one of the last size: the tile's flag, the deal data and the product's own number all say sold out | same · F6 | pass |
| A7 | F6 · A store that zeroes every size itself: out of stock whatever its own number says; a size with no count never blocks | same | pass |
| A8 | F6 · A post whose products have all sold out leaves the shop; a cancel brings it back | same | pass |
| A9 | F10 · Each size says its price and what she pays after the offer; choosing it raises no "Price changed" | same · F10 | pass |
| A10 | F4 · A shopper with no name is known as such on her account and profile; her comment reads "INFLX shopper"; once given, the name is hers; one named "Follower" by the old app is asked too | same · F4 | pass |
| A11 | F13 · Orders: "No orders yet" → "1 on the way" while packed or shipped → "1 order" once delivered; "1 creator"; the Following list | same · F13 | pass |
| A12 | F14 · A signed-in shopper's hearts are marked in a collection; a guest's are not; un-hearting needs only the product | same · F14 | pass |
| A13 | F15 · Order placed → My orders; shipped and cancelled → that order | same · F15 | pass |
| A14 | N7 · A post with no caption is titled by its products for the shopper and on its link page; the creator's own list keeps her title | same · N7 | pass |
| A15 | Nothing around it moved: the shopper, ordering, returns, return-window, links and wallet suites | 8 suites, 175 tests | pass |

## B · Phone (built 5 Oct 2026)
"jest" = the real screen rendered with the server's data shapes. **Every row is also "walk owed"** — jest cannot see a video, a swipe, a payment sheet, a notification arriving or how a screen looks. Phone suite: 110 suites, 2,624 tests, all passing (was 104 / 2,410).

| # | Expected | Proved by | Status |
|---|---|---|---|
| B1 | F1 · A cancelled, failed or refused payment releases what was held and leaves her on Review order with her bag; "It sold out while you were paying…" never opens Order placed | `screens/shop/order/__tests__/shopperAppFixesOrder.test.js` | jest · walk owed |
| B2 | F1 (X10) · She paid but INFLX could not be reached: three tries, nothing released, "…Please don't pay again", no Place order; "Check again" settles it (placed, or refunded) | same | jest · walk owed |
| B3 | F2 · Any ten digits are sent as +91 and those digits — a number starting with 91, typed with spaces or dashes, or pasted with +91 | `screens/follower/__tests__/followerLogin.test.js` | jest · walk owed |
| B4 | F3 · A session that has run out is renewed before the request; refused for good → a shopper becomes a guest quietly; no signal → the request goes as it would have; a phone clock set wrong does not cause renewals on every request; the brand and creator apps behave on a refusal as before | `services/__tests__/renewBeforeAsking.test.js` | jest · walk owed |
| B5 | F4 · No name is sent at sign-in; a shopper with no name gets the "Your name" step once; Profile reads "Add your name"; what a guest had saved is kept before the name step | `followerLogin.test.js`, `screens/shop/__tests__/shopperAppFixes.test.js` | jest · walk owed |
| B6 | F5 · Coming back to Play she is on the video she left; a newly tapped video still plays first | `shopperAppFixes.test.js` | jest · walk owed |
| B7 | F6 · "Sold out in every size" in the size sheet, pop-ups and product page with Add and Buy now off; the tile reads "Out of stock" | `components/shop/__tests__/shopperAppFixesBag.test.js`, `shopperAppFixesOrder.test.js` | jest · walk owed |
| B8 | F7 · Back from signing in, Comments shows the box to write; what she was typing is kept | `shopperAppFixes.test.js` | jest · walk owed |
| B9 | F8 · A video from a store, search, a post's page or an offer's posts opens on top with a Back arrow; from Home or Saved it opens in the Play tab | same, `components/shop/__tests__/shopperWalkVideo.test.js` (updated) | jest · walk owed |
| B10 | F9 · The bag icon has its number when the app opens; a bag that cannot be read says "Couldn't load your bag" with Try again, and nothing is added or saved over it; after log-out the icon counts the phone's own bag | `shopperAppFixesBag.test.js`, `shopperAppFixesOrder.test.js` | jest · walk owed |
| B11 | F10 · Choosing a size shows that size's price in the size sheet, the pop-up, the deal card and the product page, and that price is what is recorded | same | jest · walk owed |
| B12 | F11 · The feed (and Play) reload with her Welcome choices when she returns; a Welcome that cannot load has Try again and Skip | `shopperAppFixes.test.js` | jest · walk owed |
| B13 | F12 · A removal on "Your deal" is a removal on the deal page; removing the last item returns her there with nothing picked | `shopperAppFixesOrder.test.js` | jest · walk owed |
| B14 | F13 · Profile shows the server's Orders and Following lines; Returns opens My orders; Following and Notifications open their lists | `shopperAppFixes.test.js` | jest · walk owed |
| B15 | F14 · A like, bookmark or heart stays as she left it on the next screen; a collection shows a signed-in shopper's hearts; every saved product has Remove (signed in and guest, post live or ended) | same | jest · walk owed |
| B16 | F15 · A tapped notification opens that order, My orders, or the Notifications list; the phone is registered for notifications at sign-in; only in the shopper app | `components/shop/__tests__/notifications15.test.js`, `followerLogin.test.js` | jest · walk owed |
| B17 | N1 · An ended post says the server's sentence on the products sheet, the product page, the deal page and Comments; a failed load has Try again | `shopperAppFixes.test.js`, `shopperAppFixesOrder.test.js` | jest · walk owed |
| B18 | N2 · The sign-in line says why she is signing in; "Resend code" after 30 seconds | `followerLogin.test.js` | jest · walk owed |
| B19 | N3, N4, N5 · "To pay ₹X on delivery" until delivered; "No order matches …"; Packed and Out for delivery filters; lists load their next page at the end (stores, offer posts, comments, My orders) | `shopperAppFixesOrder.test.js`, `shopperAppFixes.test.js` | jest · walk owed |
| B20 | N6, N7 · A gift shows once; the bag writes no delivery line; "₹999" and "1 size" | `shopperAppFixesOrder.test.js` | jest · walk owed |
| B21 | N8 · The collection's contradicting sentence is gone. **The refund policy sentence is unchanged (X9).** | `screens/shop/__tests__/shop15.test.js` (updated) | jest · policy: **open** |
| B22 | Three new screens are each registered once, with their import: PlayOver, ShopFollowing, ShopNotifications | `shopperAppFixes.test.js`, `shopperWalkReturn.test.js` (the route-list check) | jest |

## B2 · The seven small faults (built 5 Oct 2026, second pass)
Phone suite after this pass: 113 suites, 2,644 tests, all passing. Every phone row is "walk owed".

| # | Expected | Proved by | Status |
|---|---|---|---|
| S1 | Addresses that cannot be read → an error with Try again, which reads them; no address at all → "Add an address" | `screens/shop/order/__tests__/shopperSmallFixes.test.js` | jest · walk owed |
| S2 | Order placed, Order details, Cancel, Return: a failed read has Try again; a refusal keeps the server's sentence with nothing to retry | same | jest · walk owed |
| S3 | A cash parcel: the item's page says what the whole parcel collects, naming delivery and the cash fee; a cancelled item is no longer collected for; delivered or paid online → nothing owed | `backend/tests/shopper-app-fixes.test.js` · S3 (2 tests), `shopperSmallFixes.test.js` | pass · jest · walk owed |
| S4 | A link to a video replaces its page with Play on top (`PlayOver`), once; a link to a photo post still opens the post's page | `screens/shop/__tests__/shopperSmallFixesBrowse.test.js` | jest · walk owed |
| S5 | A collection that cannot be read has Try again; one that has gone says the server's sentence | same | jest · walk owed |
| S6 | Renewed session + "SIGN_IN_REQUIRED" → the answer is returned and she stays signed in; a refused session is still cleared; a guest never reads "Session expired" | `services/__tests__/signInRequired.test.js` | jest |
| S7 | `createPost` is written once in the creator's calls | `shopperSmallFixesBrowse.test.js` | jest |

## C · Drift recorded (tests moved from an old behaviour to the new one — never skipped)
| File | What it said | What it says now | Why |
|---|---|---|---|
| `Packages/Mobile/src/components/shop/__tests__/shopperWalkVideo.test.js` | a video from a post's page or a store jumped to the Play tab | it is pushed on top (`PlayOver`) | F8 |
| `Packages/Mobile/src/screens/shop/__tests__/shop15.test.js` | Comments' sign-in carried no reason; a collection said each product "sells like a one-product post"; a guest's Profile had a Returns row | the reason is passed; the sentence is gone; a guest has no Returns row (it opens My orders, which is hers only when signed in) | N2, N8, F13 |
| `Packages/Mobile/src/screens/shop/__tests__/shopperWalkProducts.test.js`, `screens/shop/order/__tests__/shopperWalkBag.test.js` | Buy now's sign-in carried no reason | `reason: 'order'` | N2 |
| `backend/tests/item17-wallet.test.js` (1 line) | everything the creator is sent, ids included, must not contain the letters "fee" | the same, with random ids taken out first; a second line proves the check still catches a fee | a random id contained "fee" in the full run of 5 Oct ("…-d0553a4fee25") — a fragile check, not a product fault |
