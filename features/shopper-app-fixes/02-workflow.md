# shopper-app-fixes — how it is built and what each flow does afterwards

## Build order
1. **Server** — `backend/src/services/shopperCheckout.service.js` (F1), `stock.service.js` + `shoppablePosts.service.js` + `shopperPosts.service.js` (F6, N7), `shopperOrders.service.js` (F10, F15), `shopperEngagement.service.js` + `followerAccount.controller.js` (F4, F13), `shopperStores.service.js` (F14), `postLinks.service.js` (N7). Tests: `backend/tests/shopper-app-fixes.test.js`.
2. **Phone, two builds side by side against `BUILD_API.md`** — browsing and account (F2, F3, F4, F5, F7, F8, F11, F13, F14, F15, N1, N2, N5, N8) and ordering (F1, F6, F9, F10, F12, N1, N3, N4, N5, N6, N7).
3. **Board** — the changes that show, drawn for the record (`04-preview/`).
4. **Review** of both phone builds against the server; the whole phone suite and the whole server suite.
5. **Release only on the founder's go**: push (server + website host), then the shopper app update. No migration.

## The flows, as they are afterwards

**Paying online (F1).** Place order → the items are held and her bag is untouched → the payment sheet.
- She pays → the order is placed → what she ordered leaves the bag → Order placed.
- She closes the sheet, or the payment fails → "Payment cancelled. Nothing was charged." → the held items are released at once → her bag is as it was → she can press Place order again.
- The payment lands late and the items have sold out meanwhile → "It sold out while you were paying. Your payment is being refunded." → nothing is ordered; her bag is as it was.

**Signing in (F2, F4, N2).** Number (any ten digits, also ones starting with 91) → code ("Resend code" after 30 seconds) → a first-time shopper, or one still named "Follower", types her name once → back where she came from, signed in (Comments shows the box to write — F7).

**Staying signed in (F3).** Whatever she opens after a pause, the app renews her session first; her likes, saves and follows are hers on every page.

**Watching (F5, F8).** Play remembers the video she was on when she comes back from comments, a store, the bag or a product page. A video opened from a store, search, a post's page or an offer's posts opens on top with a Back arrow; Back returns her there.

**Buying (F6, F9, F10, F12).** A product sold out in every size reads "Out of stock" and cannot be added. The bag icon has its number from the moment the app opens. Choosing a size shows that size's price. Removing the last item on "Your deal" returns her to the deal page.

**Her account (F13, F14, F15).** Profile: Orders says how many are on the way; Following lists her creators; Notifications lists the latest; Returns opens My orders. A like or heart stays as she left it. A notification about an order opens that order.

## What does NOT change
Prices, offers, commission, the return window, cancelling and returning, the brand and creator apps, the website.
