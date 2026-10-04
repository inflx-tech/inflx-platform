# Walk report — shopper app, and upload / approval between brand and creator

**Date:** 3 Oct 2026 · **From:** the founder's walk (10 points, 10 screenshots) · **Status:** findings only. Nothing was changed, in the code or on the live system.

**How each point was checked:** the code was read, the live database was read (read-only), and the live server was asked to price example bags and to hand out pictures (calls that write nothing). Nothing was reproduced on a phone by me; where a cause rests on the founder's own phone (the bag), that is said.

Legend for "what fixing needs":
- **Phone update** — goes out over the air, no reinstall.
- **Server** — a server change, no app update.
- **Install** — an app build that already exists must be installed on the phone.
- **Draw first** — a new or redesigned screen; it is drawn and locked before any code.

---

## The four causes behind most of the list

| | Cause | Points it explains |
|---|---|---|
| R1 | **A video never gets a cover picture.** Nothing in the system makes or stores a still for a video (`post_media` has no such column; no table has one). Every screen that needs a small picture of a video shows an empty box, a black tile, or borrows the first product's photo. | 6, 9 |
| R2 | **Every picture is fetched in two steps.** The phone first asks INFLX's server where the file is, then downloads it from storage. The first step costs 0.5–1 s per picture when the server is awake and about 50 s when it has gone to sleep. | 8 (slow / missing pictures) |
| R3 | **There is no product page in the shopper app.** A product is only ever a row in a list or a small pop-up, and the server sends the phone only its name, price, photos, colours, sizes and description. | 3, 8 |
| R4 | **One blocked item blocks the whole bag, and the screen does not say so near the button.** | 5 (and part of 4) |

---

## Shopper app

### 1 · Tapping a video in the Home feed only pauses it
- **Cause.** The video block carries its own invisible "tap to pause" layer, and it sits on top of the card's "open this post" tap, so it catches the tap first. The intended behaviour is already written and working underneath: a video opens full screen in Play and goes first, then every creator's videos follow.
- **Why tests passed.** The pause layer exists only on phones that have the video player. The tests (and older app builds) have no player, so there the tap reaches "open".
- **Evidence.** `Packages/Mobile/src/components/shop/ShopVideo.js:113` (pause layer) · `components/shop/bitsShop.js:188` (card tap) · `components/shop/useShopNav.js:16` (video → Play, first).
- **Fixing needs.** Phone update, small: in a feed the tap opens; pause stays inside Play.

### 2 · The previous video's sound runs on into the next video
- **Cause.** The app uses ONE signal for two jobs. "Half on screen for one full second" is the rule for counting a post as *seen*. The same signal also decides *which video plays*. So after a swipe the app waits a full second before it stops the old video and starts the new one; the old one keeps sounding meanwhile.
- **Evidence.** `components/shop/useSeen.js:13` (`minimumViewTime: 1000`) · `components/shop/useAutoplay.js:14` · React Native's list delays every change, appear *and* disappear, by that time (`node_modules/@react-native/virtualized-lists/Lists/ViewabilityHelper.js:224`).
- **Not yet proven.** The code explains at least 1 second. The founder hears 2–3; the remainder is probably the phone's player starting up and is to be measured on the phone after the fix.
- **Fixing needs.** Phone update, small: switch the playing video the moment the swipe lands; keep the one-second rule for counting views only. The Home feed gains too (its videos start a second late today, silently).

### 3 · The product pop-up does not show what was entered at listing
- **What a listing holds (live data, 12 products).** Brand name (e.g. Park Avenue), fit, neck, sleeve, material, care, occasion, closure, compartments, type, section (Topwear / Watches / Bags), return days, an MRP box, several photos, a size chart, a description.
- **What the shopper is sent.** Name, price, photos, colours, sizes, description, size chart. Nothing else leaves the server (`backend/src/services/shopperOrders.service.js:59-68`; the live answer's fields were read on 3 Oct).
- **What the phone draws.** The description as one grey run-on line, "Details · …" (`components/shop/orderBits.js:172`). On a plain discount post it is worse: a small size sheet with one thumbnail, no photos and no details at all (`orderBits.js:253`).
- **Also seen.** Several colours have no photos of their own (e.g. Premium Polo: Navy, Black, White, Maroon), so picking a colour does not change the picture.
- **Fixing needs.** Server (send the listing details, in a fixed order) + **Draw first** (a product page — the founder's reference, frame 4). Same work as point 8.

### 4 · The bag says 9 items
> **WITHDRAWN by the founder, 4 Oct 2026** — reported by mistake; the bag count is fine. Kept below for the record only.
- **Fact.** The live server holds no bag for anyone (0 rows). So this bag is the one kept on the founder's phone, which is how a shopper who is not signed in is handled. I cannot read a phone's storage.
- **What the number is.** The total of quantities, not the number of rows (`components/shop/bag.js:43`, `screens/shop/order/BagScreen.js:77`). Things that raise it without adding a row or that are easy to miss:
  - adding the same product in the same colour and size again raises that row's quantity (up to 5);
  - the free one of a buy-one-get-one pair counts as an item;
  - items whose post has left the shop still count.
- **Also found.** The number on the bag icon is not read when the app opens; it shows nothing until the bag is opened or something is added.
- **Needed from the founder.** A screenshot of the Bag screen, to say which of the three it is.
- **Fixing needs.** Phone update, after deciding what the number should mean (rows or pieces) and whether unavailable items count.

### 5 · "Continue · ₹…" is greyed out — payment cannot be reached
> **WITHDRAWN by the founder, 4 Oct 2026** — Continue works and he has placed an order. Kept below for the record only (the "one blocked item blocks the bag" behaviour is real, but he does not count it as a problem).
- **The founder's words** placed this on Orders; the button with that label is on the **Bag** screen (the Orders screen has no such button).
- **Cause.** If any ONE item in the bag cannot be bought, the whole bag cannot continue. The button stays grey but still shows the amount of the items that are fine, and the only explanation is a small red line inside that item's group, far from the button.
- **Proved on the live server, 3 Oct** (a pricing call; it writes nothing):

  | Example bag | Can continue | Amount shown | What it says |
  |---|---|---|---|
  | one tee | yes | ₹629 | — |
  | the same tee + one item from the post whose offer was ended today | **no** | ₹629 | "No longer available with this offer" |
  | one item of the 3-item set | **no** | ₹500 | "Sold only as the whole set" |
  | an item from the post that enters the shop on 4 Oct | **no** | ₹0 | "No longer available with this offer" (wrong words: it has not started) |
  | the whole set + 2 tees + a buy-one-get-one pair | yes | ₹10,717 | — |

- **Most likely on the founder's phone.** An item added on 1–2 Oct from the "Year end sale" post, whose offer was ended and deleted on 3 Oct. To confirm: the same Bag screenshot.
- **Fact.** No order has ever been placed on the live system (0 checkouts).
- **Evidence.** `backend/src/services/orderPricing.service.js:131, 360, 497` · `screens/shop/order/BagScreen.js:182`.
- **Not rechecked today.** On 1 Oct live payments were still in test mode; if that is unchanged, the step after Continue shows a test prompt, not the real payment sheet.
- **Fixing needs.** Phone update + a decision: say the reason beside the button, and either set unavailable items aside by themselves or offer "Remove what can't be bought".

### 6 · A saved post shows a product photo
- **Cause (R1).** For a video post there is no cover picture, so the tile uses the first product's photo (`components/shop/bitsShop.js:368`). All five posts on the live system are videos, so every saved post does this. The same tile is used in the creator's and brand's stores.
- **Fixing needs.** A cover picture for every video (see "Decisions"), then a phone update.

### 7 · "They buy a product from your post and get the same product free…"
- **Cause.** That sentence was written for the creator's terms screen ("How it works for shoppers"), and the server sends the same sentence to the shopper. All ten offer kinds are written this way ("they", "your post"), not only buy-one-get-one.
- **Evidence.** `backend/src/services/offerRules.js:451-470`, used for shoppers at `backend/src/services/shopperPosts.service.js:289`. Read from the live server for three posts on 3 Oct.
- **Fixing needs.** Server only: a second set of the ten sentences in the shopper's voice. No app update.

### 8 · "Shop this post" — the look, and slow or missing pictures
- **Today.** A list: a 40 × 50 thumbnail, name, price, a heart and a small "Add". Tapping a row starts adding it. There is no product page to open. On a deal post the same list also carries "Build your deal".
- **The founder's reference.** A sheet "Products in this post" as a grid of three with large photos and a bag icon on each; "added to bag · View bag"; tapping a photo opens a full product page; Back returns to the sheet.
- **Slow / missing pictures (R2), measured 3 Oct.** The photos are small (17–160 KB). The delay is the first step: each one first asks INFLX's server where the file is. That step took 0.5–1.0 s per picture with the server awake, and **53 s** for the first picture after the server had gone to sleep. A grid of 12 means 12 such questions. While the server wakes, pictures stay blank, and one that gives up stays missing until the screen is reopened.
- **Also measured.** Pricing a bag takes about 1.6 s per call on the live server, so every quantity change and every pick on a deal page waits that long.
- **Evidence.** `backend/src/controllers/mediaAsset.controller.js:302` and `creatorPosts.controller.js:83` (the "where is it" step) · `components/shop/bitsShop.js:289-336` (the sheet).
- **Fixing needs.** **Draw first** (sheet + product page, with point 3). Pictures: a server and hosting decision (see "Decisions").

### 11 · After "Add to bag" the shopper should be back among the posts (added by the founder, 4 Oct 2026)
- **What he wants.** Tap "Add to bag" → it is added → a short vibration → the button turns into "Go to bag" for a moment → the app returns her by itself to the posts she was browsing. A small bag icon is always there while she browses, and it opens the bag. The same every time, whether the bag is empty or not. She goes to the bag only when she chooses.
- **Today, a deal post.** Build your deal → Review your deal → "Add to bag" adds it and then opens the **Bag** (`screens/shop/order/DealReviewScreen.js:45`). To keep shopping she presses Back through Bag, Review and the deal page.
- **Today, a plain discount post.** "Add to bag" closes the size sheet and leaves her on the "Shop this post" sheet, which now says "✓ In your bag" and shows "Go to bag · N" (`components/shop/bitsShop.js:271-278, 330`). She closes the sheet herself.
- **Today, the bag icon.** In the top bar of Home, Discover, Saved, Profile, an opened post and the creator / brand stores. **Not** on the full-screen video feed (Play), and not on the deal pages.
- **Today, vibration.** None anywhere in the shopper app. The phone's permission for it has been inside every app build since 27 Jun 2026, so it needs no new build.
- **Fixing needs.** Phone update. Open: where exactly she lands (the same place she left, or a page of similar posts), and how the bag icon looks on the full-screen video feed — to be drawn with points 3 and 8.

### 12 · A plain discount post shows "Build your deal" for about 2 seconds (added 4 Oct 2026)
- **Cause.** Until the deal data arrives the phone guesses from the post card, comparing the offer's type with the word `discount`. The card carries the type's display name, "Discount" with a capital D, so the guess is always "this is a deal". When the deal data arrives (2.4 s measured on live for P4KGMB) it says `deal_page = false` and the button goes. In those seconds a tap on Add opens the deal page for a plain discount.
- **Evidence.** `Packages/Mobile/src/components/shop/bitsShop.js:261` · the card's `offer.type` comes from `TYPE_LABEL` (`backend/src/services/offerRules.js:31`, via `shoppablePosts.offerWords`). Read from live on 4 Oct: card `offer.type = "Discount"`, deal data `deal_page = false`.
- **Fixing needs.** Phone update, small (decide from `sub_type`, which the card already carries correctly).

### 13 · One item of a deal can have its quantity raised in the bag, which breaks the deal (added 4 Oct 2026)
- **Cause.** The bag draws the − 1 + control on every paid item, deal or not (`screens/shop/order/BagScreen.js:133-135`).
- **Proved on live, 4 Oct** (pricing calls; nothing written):

  | Bag | Can continue | Total | Says |
  |---|---|---|---|
  | the ₹5,000 set, each item once | yes | ₹5,000 | 1 set |
  | the set, red t shirt raised to 2 | **no** | ₹5,500 | "Sold only as the whole set" |
  | the set, every item raised to 2 | yes | ₹10,000 | 2 sets |
  | buy one get one, the paid heels raised to 2 | yes | ₹9,198 | 1 pair — the extra one is full price with no free one |
  | buy more save more, tee raised 1 → 3 | yes | ₹1,467 | 30% off (raising is how this offer works) |
  | plain 20% discount, Blue polo × 2 | yes | ₹1,438 | — |

- **The founder's rule.** On a deal, the quantity of a single item cannot be changed.
- **Open.** "Buy more, save more" and "spend and get a gift" work BY raising quantity; whether the rule covers them too is his to decide. Changing a deal already has its own door ("Edit deal").
- **Fixing needs.** Phone update.

---

## Between brand and creator

### 9 · Blank and black pictures; the brand cannot play the video
| What is seen | Cause | Fixing needs |
|---|---|---|
| Empty grey squares beside every post, on the creator's "Going live" and the brand's review and "Her posts" | The row draws an empty box and was never wired to a picture (`screens/influencer/SaleLiveScreen.js:91`). The server already sends one (`backend/src/services/saleLive.service.js:79`) — but for a video that "picture" is the video file (R1). | Cover pictures (R1) + phone update |
| Black tiles with a play mark and a duration | By construction: a video tile has no still to show (`components/content/bits12.js:75`). | Cover pictures (R1) + phone update |
| The brand taps a file: "Update INFLX to play videos · Open in browser" | The brand app on the founder's phone is an install from before 30 Sep; the player is inside the builds made on 30 Sep. Those builds exist and contain the player (checked): `Packages/Mobile/android/app/build/outputs/apk/brand/release/app-brand-release.apk` and `…/influencer/release/app-influencer-release.apk`, both 30 Sep 08:21. The shopper app on the same phone already plays videos. | **Install** the 30 Sep brand and creator builds. No code change. |
| While making a shoppable post, the uploaded video is an empty tile; on the review step it is only "▶"; "My posts" has no pictures | Same as above (R1): `screens/create/PostMediaScreen.js:123`, `PostReviewScreen.js:66`. | Cover pictures (R1) + phone update |

Other faults visible in the screenshots:
- "Send to Aveen fashion boutique and desiner studio" breaks into two left-aligned lines inside the button.
- The viewer's title is cut in the middle ("This good offer · SH…Instagram reel · 1 of 1").
- On the creator's screen every post appears twice: as a card she is filling, and again in the list below with "+". The list is for adding another place for the same post, and nothing says so.
- When a row has no file ("0 of 1") the Send button is grey and no line says why.
- "1 of 1" on each row counts files and does not say so.

### 10 · "4 of 1 approved", and one post "Approved" while the others are "Live"
- **"4 of 1 approved".** It means "4 approved, the minimum is 1" (`components/sale/copy14.js:32`). Live data: the minimum is 1 and four posts are approved. It read "3 of 1" when three were. Once she passes the minimum the line reads as a mistake.
- **"Approved" against "Live".** The post P4KGMB uses the offer "Percentage Discount Test", which starts on 4 Oct. By the 1 Oct rule a post enters the shop only while its offer runs, so it waits one day; the other three offers started on 3 Oct. The brand's screen says "In the shop from 4 Oct"; the creator's screen shows "Approved" with no reason.
- **The fifth post.** KNTZXR, in the other set ("Men"); it was taken out when its offer "Year end sale" was ended.
- **Fixing needs.** Phone update, wording only: e.g. "4 approved · minimum 1 met", and the creator's row gains "In the shop from 4 Oct".

---

## What needs what

| Kind of work | Points |
|---|---|
| Phone update, small, no new screen | 1, 2, 10, the wording and button faults in 9, the reason beside Continue in 5, the bag number in 4 |
| Server only | 7 |
| Install existing builds | 9 (playing videos in the brand and creator apps) |
| Draw first, then server + phone | 3 + 8 (product sheet and product page) |
| Decision first | Video cover pictures (6, 9) · how pictures are delivered (8) · what the bag number means (4) · what happens to unavailable items (5) |

## Decisions for the founder
1. **Video covers.** Where the still comes from: the creator's phone makes it at upload (needs a new app build), or the server makes it after upload (no new build, more server work).
2. **Picture delivery.** Serve pictures straight from a public picture address so the phone asks once, and keep the server awake. Both touch hosting and may cost money.
3. **The bag.** Rows or pieces; and whether unavailable items are set aside by themselves.
4. **Point 8.** Whether the reference's frames 2–5 are the target as drawn (grid of three, bag icon, full product page with Add to bag and Buy now).

## Still owed
- The Bag screenshot (points 4 and 5).
- A device check of point 2 after the fix (1 s explained, 2–3 s heard).
