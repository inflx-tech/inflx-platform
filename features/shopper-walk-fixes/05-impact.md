# shopper-walk-fixes — impact

**Verdict.** Production-impacting: two migrations, a server release, the brand website, and an update of all three phone apps. One money RULE changes (when a sale's shares are released); no money moves by itself. No new app install is needed.

## 1 · What changes for people

| Who | Changes |
|---|---|
| Shopper | A tap on a feed video opens it; sound stops on the swipe; a new "Products in this post" grid; a product page with the listing's details and the returns line; Add to bag → vibration → "Go to bag" → back where she was; the bag icon everywhere; a deal stays whole in the bag; **Return** on a delivered item inside the window. |
| Creator | Pictures on her posts and videos; "4 approved · ✓ Minimum 1 met"; "In the shop from…"; "1 file / No file yet"; a heading over the add list; a Send button that fits and says why it is grey; her phone uploads one small picture with each video. **Her commission is added after delivery + the window** (it was: once shipped and the window counted from the order). |
| Brand | The same pictures and count line; the viewer's two-line title; "Returned" and "Return requested" on its orders; wallet words "on its way · waiting for delivery" and "returned". **Its sales money is added after delivery + the window.** |
| INFLX admin | Return window typed in hours or days, in one place; the box leaves Pricing › Categories and the old Payments page; the Returns page decides item returns and "Mark refunded" itself refunds; INFLX's share counts as earned after delivery + the window. |

## 2 · The one rule that changes (W13)

| | Before | After |
|---|---|---|
| Online order | shares added once the parcel had **shipped** and the window, counted **from the order**, had passed | added once it is **delivered** and the window, counted **from the delivery**, has closed |
| Cash on delivery | delivered + window from delivery | the same (unchanged) |
| How often | once a night (00:01, 00:05) | every hour (:01, :06) |
| Whose number | the category's, else the platform's | the platform's only |
| Unit | whole days | hours (typed in hours or days) |

**On live today:** 18 sales carry a window stamp; they keep their stamped LENGTH (30 days for all but those made after 4 Oct, 7 days). Under the new rule each is released that long after its DELIVERY. The two orders the founder placed on 4 Oct: 30 days after they are delivered. Nothing already added to a wallet is touched.

## 3 · Database

| Migration | What | Risk |
|---|---|---|
| 202 | `payment_config.return_window_hours` (filled from days × 24, NOT NULL, 1–8760); `post_media.cover_r2_key`; `content_files.cover_key` | additive; one-row table; `lock_timeout 5s` |
| 203 | `follower_returns.order_line_id`, `request_id` + 2 indexes; `order_lines` checks widened: `cancelled_by` gains `return`, `refund_status` gains `manual` | additive; the two checks are dropped and re-made on a small table (a brief lock) |

Order: **migrate → push → OTA** (the code reads the new columns; before 202 the settings read falls back to 30 days for the minute between).
Already changed on live on 4 Oct (data only): the return window 30 → 7 on the platform row and all 16 category rows.

## 4 · Server (Render)

- New: `returnWindow.service`, `productDetails.service`, `shopperReturns.service`.
- Changed: `paymentConfig`, `pricing` (category window ignored), `settlement` (stamp; delivered + window guard), both money jobs + their schedule, `walletRead` (states `waiting_delivery`, `returned`), `agreementTerms` / `agreementDocument` (the sentence in hours or days), `offerRules` (ten shopper sentences), `shopperPosts` (card: `deal_page`, `offer.kind`, `cover_url`), `shopperOrders` (deal data: details, returns line; orders: return fields; the brand's parcels), `shoppablePosts` / `creatorPosts` / `saleLive` / `content` (video pictures), `returns.controller`, `categories.controller`, `admin.controller`, routes.
- New routes: `GET /v1/media/post/:id/cover` (public, like the slide); creator `POST …/content/files/:fileId/cover-url` and `…/cover`; shopper `GET|POST /follower/orders/lines/:id/return`.
- Old phone builds / an app not yet updated: every new field is additive; the old screens ignore them. The one visible effect before the phone update: the deal sentence already reads for the shopper.

## 5 · Website (Vercel)

Admin: Money › Settings (hours / days), Pricing › Categories (box removed), Settings › Payments (row removed), Returns (item returns), Money › Sales and a person's page (two new states). Brand: Wallet (two new states), Orders (returned / return requested).

## 6 · Phones (OTA, all three)

No native change: `Vibration` (permission in every build since 27 Jun) and `react-native-compressor`'s picture call (in the 30 Sep builds). On an install older than 30 Sep: no video picture is made, and videos still say "Update INFLX to play videos".

## 7 · What can go wrong, and the guard

| Risk | Guard |
|---|---|
| A share released before delivery | asked twice: in each job's SQL and again in `settleCommerceTransaction` |
| A refund sent for a sale already in the wallets | `complete()` refuses, as cancel does; an open return holds the sale so it cannot be |
| A return double-counted | one open return per item; "refunded" only from "approved"; the claw-back and the status move in one transaction |
| A picture upload breaking a video upload | every picture step is after the video is safe and is swallowed on failure |
| A discount post opening a deal page | the server decides (`deal_page`); the phone no longer guesses |
| The window changed by mistake | 1 hour – 365 days, whole numbers; a sale keeps its own stamp |

## 8 · Undo

Code: revert the commit and republish the three OTAs. Migrations are additive (the widened checks can stay). The live setting: `node backend/scripts/set-return-window.js --days=30 --apply`.
