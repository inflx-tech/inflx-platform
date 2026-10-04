# shopper-walk-fixes — expected results

"Proved by" names the automated check. **A device walk is owed for every phone row** — nothing here has been seen on a phone.

## A · The return window (W11, W13) — server
| # | Expected | Proved by | Status |
|---|---|---|---|
| A1 | The admin saves 24 hours; it is kept as 24 hours; the days column follows, rounded up | `shopper-walk-fixes-return-window.test.js` | pass |
| A2 | Anything older that sends whole days sets the same number | same | pass |
| A3 | 0, a fraction of an hour, more than 365 days are refused; the number stays | same | pass |
| A4 | Only INFLX's admin can set it | same | pass |
| A5 | A sale is stamped with the platform number, whatever its category or product says | same | pass |
| A6 | Changing the number never moves a sale already made | same | pass |
| A7 | Online order: nothing added when shipped, nor at delivery; all three shares when the window after delivery closes; never twice | same | pass |
| A8 | Cash on delivery follows the same clock | same | pass |
| A9 | 7 days after DELIVERY, not after ordering | same | pass |
| A10 | A new agreement says "After the 24-hour return window" / "After the 7-day return window"; a sent one keeps its words | same | pass |
| A11 | Wallets say "not shipped yet", "on its way · waiting for delivery", then the date | `item17-wallet.test.js` (updated), phone `wallet17.test.js` | pass |

## B · What the shopper's screens are sent — server
| # | Expected | Proved by | Status |
|---|---|---|---|
| B1 | A discount post: `deal_page` false on the card and in the deal data; a buy-one-get-one post: true | `shopper-walk-fixes-shop.test.js` | pass |
| B2 | Ten sentences said to the shopper; none says "they" or "your post"; the creator's own sentence is unchanged | same | pass |
| B3 | A product carries brand, category, the listing's details in the fixed order, empty ones left out; nothing invented | same | pass |
| B4 | The returns line is INFLX's one window, whatever the product's own number says | same | pass |
| B5 | A video post carries its picture: on the card, served like the video, and on Going live for both sides | same | pass |
| B6 | A video with no picture: cover is null, never the video file | same | pass |
| B7 | The picture must be her own upload for this post, a JPEG, ≤ 2 MB | same | pass |
| B8 | A shared file: her phone adds the picture; the brand sees it only once she has sent the file; a stranger gets nothing | same | pass |

## C · Returns (W14) — server
| # | Expected | Proved by | Status |
|---|---|---|---|
| C1 | Not before it is delivered | `shopper-walk-fixes-returns.test.js` | pass |
| C2 | Inside the window: until when, what goes back, what she gets, five reasons | same | pass |
| C3 | Not after the window has closed; the sentence names the window | same | pass |
| C4 | Her window is the one stamped on HER sale | same | pass |
| C5 | A reason is needed; "Other" needs a note; nobody else can ask | same | pass |
| C6 | One request; "Return requested"; all three shares wait though the window has closed; the brand sees it and cannot decide it | same | pass |
| C7 | Rejected: a note is required; she is told; the sale stands and its shares are added | same | pass |
| C8 | Approved then refunded: the item is undone like a cancel; stock back; commission out of pending; online payment refunded; once only; the kept item settles alone | same | pass |
| C9 | Cash on delivery: refund marked for INFLX to pay by hand | same | pass |
| C10 | The admin list shows the item, what was paid, how it was paid | same | pass |
| C13 | My orders: a returned item is under "Returned", not under "Cancelled" | same | pass |
| C11 | A deal's items go back together: one request, approved together, undone together, one refund | same (a buy-more-save-more deal) | pass |
| C12 | A gift follows what earned it | reuses `cancelSet` (proved for cancels by `shopper-ordering.test.js` C31); no return-specific test | **not separately proved** |

## D · Phones (built 4 Oct 2026)
"jest" = proved by an automated test of the screen with the server's data shapes. **Every row is also "walk owed":** jest cannot see a video, a swipe, a vibration, a picture loading or how a screen looks. Phone suite: 104 suites, 2,410 tests, all passing (was 94 / 2,153).

### Shopper app — video (board V1–V3)
| # | Expected | Proved by | Status |
|---|---|---|---|
| D1 | A tap on a video in a feed opens it full screen (Play); nothing over the video takes the tap; a tap pauses only in Play | `components/shop/__tests__/shopperWalkVideo.test.js` · V1 | jest · walk owed |
| D2 | The video that plays changes the moment a swipe lands (its own rule, no one-second wait); "seen" still counts after one second; only one plays | same · V2 | jest · walk owed |
| D3 | A video's tile and still show the picture taken from the video; a video without one shows the first product's photo as before | same · V3 | jest · walk owed |
| D4 | Play: the bag icon with its count sits beside the sound button | same, `shop15.test.js` | jest · walk owed |

### Shopper app — ordering (board S1–S7, G1–G2)
| # | Expected | Proved by | Status |
|---|---|---|---|
| D5 | A discount or price post never shows "Build your deal" — not even for a moment; the server's `deal_page` decides | `screens/shop/__tests__/shopperWalkProducts.test.js` · O1 | jest · walk owed |
| D6 | "Products in this post": a grid of three, "N items · creator · brand", heart and bag icon on each product; the deal's sentence is said to the shopper | same · O2 | jest · walk owed |
| D7 | The product page: photos to swipe, name, brand, price, colour, size, then Brand · Category · every listed detail · Returns · Description; nothing invented; a deal product's button is "Build your deal" | same · O3 | jest · walk owed |
| D8 | The same details block in the deal page's product pop-up | `screens/shop/order/__tests__/shopperWalkBag.test.js` | jest · walk owed |
| D9 | Add to bag: one vibration, "✓ Added to your bag", the button reads "Go to bag ›" for about a second, then she is back where she was; "Go to bag ›" opens the bag; nothing is added twice | `shopperWalkProducts.test.js` · O6, `shopperWalkBag.test.js` · O6, `order17.test.js` (updated) | jest · walk owed |
| D10 | The bag icon with its count on the deal page, the review, the product page and Play; it is marked for a moment when the count goes up | same | jest · walk owed |
| D11 | In the bag a set, a bundle and buy one get one are one group: one tick, no − 1 +, no Remove on one item; Edit deal and Remove deal; ticking one piece back brings the whole deal back | `shopperWalkBag.test.js` · O7 | jest · walk owed |
| D12 | A plain discount, buy more save more and spend-for-a-gift keep − 1 + | same | jest · walk owed |

### Shopper app — Return (no board; the Cancel screens with Return's words — W14)
| # | Expected | Proved by | Status |
|---|---|---|---|
| D13 | Order details, delivered and inside the window: a Return button and "You can return this until Sun, 11 Oct, 4:30 pm." | `screens/shop/order/__tests__/shopperWalkReturn.test.js` | jest · walk owed |
| D14 | Window closed: the server's sentence, no button. Not delivered yet: no Return button | same | jest · walk owed |
| D15 | Her return shows as a box: requested, approved, not accepted with INFLX's note, returned with what happened to the money (online: on its way; cash: INFLX sends it directly) — said once | same | jest · walk owed |
| D16 | My orders: a "Returned" filter; a returned row never reads "Arrives by"; a return being decided is said on its row | same | jest · walk owed |
| D17 | The Return screen: what goes back (a deal together, warned), until when, a reason (required; "Other" needs a note), the refund and how it works as the server says them → "Return requested" | same | jest · walk owed |
| D18 | The server's refusal is shown in its own words (window closed; already asked) | same | jest · walk owed |
| D19 | No sentence on the phone states a number of days — the window is the admin's setting | same | jest |
| D20 | The Return screen is registered once; no route name is used twice; every screen a route names is imported | same | jest |

### Brand app and creator app — Going live, Pay for Content, the post maker (board B1–B2, C1–C3)
| # | Expected | Proved by | Status |
|---|---|---|---|
| D21 | "4 approved · ✓ Minimum 1 met" once the minimum is met — never "4 of 1 approved"; unchanged while short | `screens/__tests__/goingLiveWalkFixes.test.js` | jest · walk owed |
| D22 | Each post row shows its picture; a video shows the picture taken from it with a play mark; a video without one keeps the dark tile | same, `components/content/__tests__/videoCover12.test.js`, `screens/__tests__/contentVideoPictures.test.js` | jest · walk owed |
| D23 | Adding a video: the video is uploaded exactly as before, then her phone makes and sends its picture; a picture that cannot be made or sent never stops or marks the video | `utils/__tests__/videoPicture.test.js`, `videoCover12.test.js`, `goingLiveWalkFixes.test.js`, `contentVideoPictures.test.js` | jest · walk owed |
| D24 | An approved post that is not in the shop yet says "In the shop from …" on both sides | `goingLiveWalkFixes.test.js` | jest · walk owed |
| D25 | A row's chip says "1 file" / "No file yet"; the approved posts under her rows have a heading; "Send to …" is one line; a grey Send says which row still needs its file | same, `components/settings/__tests__/primaryOneLine.test.js` | jest · walk owed |
| D26 | The viewer's title is two lines: the post, then the place and which file | `components/content/__tests__/mediaViewer12.test.js` (updated), `goingLiveWalkFixes.test.js` | jest · walk owed |
| D27 | The post maker: a video slide shows its picture, play mark and length; a tap plays it; the picture's key goes out with every later save; her post rows show the post's own picture | `screens/create/__tests__/videoPicture13.test.js` | jest · walk owed |
| D28 | Wallets: "not shipped yet", "on its way · waiting for delivery", "returned"; a new agreement says "After the 7-day return window" | `screens/__tests__/wallet17.test.js` (updated) | jest · walk owed |

### Website (brand and admin)
Walked on 4 Oct 2026 in a **local preview** (a private scratch database with five test orders and two return requests; never production; no SMS, mock payments). Nothing here has been opened on the live site.
| # | Expected | Proved by | Status |
|---|---|---|---|
| D29 | Admin › Money › Settings: the return window in hours or days | Opened showing "7 days". Saved 24 hours → "Return window is now 24 hours.", the database held 24 h (1 day), the page reloaded as "24 hours". 400 days was refused ("Enter a whole number, from 1 hour to 365 days."). Saved 7 days again | pass (local preview) |
| D30 | Admin › Returns: an item return shows the item, what was paid and how; approve, reject with a note, mark refunded | Both requests listed with item, shopper, reason, paid, "Paid online" / "Cash on delivery". Online: Approve → Mark refunded → "Refunded ₹1,600 to the shopper". Cash: Approve → Mark refunded → "Returned. Pay ₹1,200 to the shopper by hand (cash order)". Reject keeps its button grey until a reason is typed. The database matched (items undone, refund issued / manual) | pass (local preview) |
| D30a | **Found on this walk and fixed:** Approve, Reject and Mark refunded were hidden from EVERY admin — the page read the admin's role from the user kept at sign-in, which never carries it. It now asks the server (`/admin/me`) and follows the server's own rule (superadmin, or the Returns permission) | the buttons appeared after the fix and the whole flow above ran through them | fixed · pass (local preview) |
| D31 | The category page and the old payment-settings page no longer offer a return-window number; the category page says where it is now | opened both | pass (local preview) |
| D32 | Admin › Money › Sales and the brand's wallet say "Not shipped yet", "On its way · waiting for delivery", "until 11 Oct", "Returned" (₹0 to everyone) | opened both | pass (local preview) |
| D33 | The brand's order list says "Returned" on a parcel whose items all went back (it read "₹0 · Delivered"), "return requested" on one being decided, and a returned or cancelled item no longer shows a money split | opened the returned cash order | pass (local preview) |
| D34 | The wallet's sentences follow the new rule: "N sales not added yet" (was "in their return window"), "added after the order is delivered and its return window closes — the same for online and cash-on-delivery orders" (was "Cash-on-delivery orders count once delivered") — website and phone | opened the brand wallet; phone: `brandWallet.test.js`, `creatorWallet.test.js`, `wallet17.test.js` (updated) | pass (local preview) · jest |

## Drift recorded (tests moved from an old rule to the new one — never skipped)
| File | What it said | What it says now | Why |
|---|---|---|---|
| `backend/tests/item17-wallet.test.js` (5 places) | an online sale is added once shipped and its date has passed; a fresh sale is "window" with a date | added only after delivery + window; a fresh sale is "not shipped yet" with no date | W13 |
| `backend/tests/shopper-ordering.test.js` (C32, 6.13) | shipped is enough | delivered + window | W13 |
| `backend/tests/settlement.test.js` | the seeded sale had no parcel; the stamp used the category's window | the seed carries a delivered parcel; the stamp is the one platform window | W13, W11 |
| `backend/tests/settlement-retry.test.js` | the seeded sale had no parcel | the seed carries a delivered parcel with its window behind it | W13 |
| `backend/tests/shopper-app-v2.test.js` (1 line) | the bundle's sentence matched "pick any 2" (the creator's: "They pick any 2… from your post") | "Pick any 2 of these N products and pay ₹2,999 for them together." and no "they" / "your post" | O5 |
| `Packages/Mobile/src/screens/__tests__/wallet17.test.js` | "…added to your wallet once it ships." | "…after it is delivered and its return window closes." + the new state | W13 |
| `Packages/Mobile/src/components/shop/__tests__/video16.test.js` | the pause layer was on every video | Play asks for it (`tapToPause`); a feed video has none | V1 |
| `Packages/Mobile/src/screens/shop/__tests__/shop15.test.js` | the sheet was titled "Shop this post" with "creator · brand" under it | "Products in this post" with "N items · creator · brand" | O2 |
| `Packages/Mobile/src/screens/shop/order/__tests__/order17.test.js` | Add to bag on the review opened the Bag; a bundle's items each had a tick | add → "Go to bag ›" → the pages close by themselves; a bundle has one group tick; the group carries `sub_type` as the server sends it | O6, O7 |
| `Packages/Mobile/src/components/content/__tests__/mediaViewer12.test.js`, `screens/__tests__/saleLiveScreens.test.js`, `screens/__tests__/contentScreens.test.js` | the viewer's title was one line "label · 1 of 1"; the count read "n of m approved" when met; a row's chip read "1 of 1" | two title lines; "n approved · ✓ Minimum m met"; "1 file" | B1–B2, C1–C2 |
| `Packages/Mobile/src/screens/brand/__tests__/brandWallet.test.js`, `screens/influencer/__tests__/creatorWallet.test.js`, `screens/__tests__/wallet17.test.js` (4 more lines) | "N sales in their return window", "No sales in a return window", "In return window", "Commission is added … when each sale's return window closes." | "N sales not added yet", "No sales waiting", "Not added yet", "… after each sale is delivered and its return window closes." | W13 — a sale that is coming may not be delivered yet |
