# Diff notes — shopper-walk-fixes

Against the locked board `04-preview/mockups/shopper-walk-fixes-mockups-v1.html` (17 frames: V1–V3, S1–S7,
G1–G2, B1–B2, C1–C3; locked by the founder on 4 Oct 2026) and decisions W1–W15 in `01-spec.md`.
The Return screens (W14) have no board by the founder's instruction: they are the Cancel screens with
Return's words.

## Where this stands — read this first

- **Nothing here has been seen on a phone.** Every phone line below is from the code and from jest.
  Jest cannot see a video play, a swipe land, a vibration, a picture load, or how a screen looks.
  A device walk is owed for every row of `03-expected-outputs.md` section D marked "walk owed".
  There are no after-shots in this folder.
- **The website was walked only in a local preview** (a private scratch database, never production):
  the admin's return-window setting, Admin › Returns from request to refund, Admin › Money › Sales, the
  brand's wallet and order pages. Nothing has been opened on the live site.
- **Released on the founder's go of 4 Oct 2026** ("Yes pls go ahead and release"). Migrations 202 and
  203 were applied on production first (nothing moved); the server, the website and the three phone
  updates follow with this commit — the record is in `lock.json` → `deployed_to_production`. The return
  window number itself had already been set on live, 30 → 7 days (`lock.json` → `live_setting_changes`).
- **Released without a device walk and without the website being opened on live** — the founder chose
  to release and walk after. Everything "walk owed" below is still owed.
- This file existing is what the release gate (Rule 4) looks for. **It is not the diff sign-off.**

## What was implemented

**Server**
- The return window is one platform number kept in hours; the admin sets it in hours or days (1 hour to
  365 days). A sale is stamped with it; changing it never moves a sale already made.
- After delivery — online and cash alike — the creator's commission, INFLX's share and the brand's money
  are added when the window closes. The two money jobs run hourly. Category and product return numbers
  are no longer read.
- The shopper's Return: preview and request on a delivered item inside the window; a deal's items go
  back together; INFLX approves, rejects (note required) or marks refunded; an open return holds the
  sale's shares; refunded undoes the item like a cancel (stock back, commission out of pending, online
  payment refunded, cash marked for INFLX to pay by hand). My orders has a "Returned" filter.
- What the shopper's screens are sent: `deal_page` on every post card, the deal's sentence said to the
  shopper, the listing's details in a fixed order, INFLX's one returns line, a video's picture.
- Video pictures: a post's video slide and a shared content file can each carry a JPEG taken from the
  video (2 MB / 1 MB), served like the file itself.

**Shopper app**
- A tap on a feed video opens it full screen; the playing video changes the moment a swipe lands; a
  video's tile shows the video's own picture.
- "Products in this post" is a grid of three with a heart and a bag icon on each product; the photo
  opens a product page with the listing's details; a discount post never shows "Build your deal".
- Add to bag: one vibration, "Go to bag ›" for about a second, then back where she was; the bag icon
  with its count on Play, the deal page, the review and the product page.
- In the bag a set, a bundle and buy one get one are one group with one tick, Edit deal and Remove deal.
- Return: a button on Order details with until when, the Return screen, the return's box on the order,
  a "Returned" filter.

**Brand app and creator app**
- Going live: "4 approved · ✓ Minimum 1 met"; post rows and shared videos show pictures; "In the shop
  from …" on both sides; "1 file" chips; a heading over the posts she can still add; "Send to …" on one
  line; a grey Send says which row needs its file; the viewer's title is two lines.
- Pay for Content and the post maker: a video shows the picture taken from it; her phone makes and
  sends that picture right after the video is uploaded; a tap on a video slide plays it.
- Wallets and agreements follow the new timing in their words.

**Website**
- Admin › Money › Settings: Return window with an hours / days chooser. The category page and the old
  payment-settings page no longer offer a return number.
- Admin › Returns decides item returns; Admin › Money › Sales and the brand's wallet and order pages say
  "not shipped yet", "on its way", "returned".

## Found while building, and fixed

1. **Admin › Returns hid Approve, Reject and Mark refunded from every admin.** The page read the admin's
   role from the user kept at sign-in, which never carries it. Found only because the page was opened
   in a browser; no test covered it. It now asks the server who may decide. Without this, no return
   could ever have been decided. (The same fault is on Admin › Brands' fee editing and on Outreach ›
   Settings — not part of this contract; flagged as its own task.)
2. The wallet's sentences still described the old timing ("N sales in their return window" for sales
   not yet delivered; "Cash-on-delivery orders count once delivered"). Now "N sales not added yet" and
   "after the order is delivered and its return window closes" — website and phone. This changes four
   lines of the item 17 board's wording, because the rule under them changed (W13).
3. The brand's order list read "₹0 · Delivered" for a parcel whose items had all been returned. It now
   reads "Returned", says "return requested" while one is being decided, and no longer shows a money
   split on a returned or cancelled item.
4. My orders listed a returned item under "Cancelled". It has its own "Returned" filter.
5. Two existing server tests and the phone tests listed under "Drift recorded" in
   `03-expected-outputs.md` were moved to the new rules, each with a note. None was skipped or removed.

## Where the build departs from the locked board

Shopper app
- Product page (S3, S4): Back, heart and bag stay over the photo while she scrolls (the frame lets them
  scroll away). "Build your deal" replaces the product page with the deal page, so Back from the deal
  goes to the post, not to the product page.
- Products sheet (S1, S2): the offer's sentence still shows on a discount post; the heart sits on a
  small white circle so it shows on a dark photo; a product that has run out still says "Out of stock";
  "✓ In your bag" is read from her bag each time the sheet opens; the size sheet waits for the sizes
  before it lets her add.
- After Add to bag (S5–S7): if she taps the bag icon in that second nothing closes under her; the bag
  icon is ringed for about 2.5 s when its count goes up.
- Bag icon: yellow count over a video or photo as drawn; the existing top bars keep their black count.
- Bag (G1, G2): ticking one piece of an unticked deal back brings the whole deal back (it asks the
  server once what kind of deal it is). A set or bundle shows only the group price; buy one get one
  shows each item's price. The group's header name is one line with "…" on every group.
- A video that is itself the opened post also goes full screen on a tap.

Brand and creator apps
- "Share another post, or another place" shows only when she already has at least one row.
- A video slide in the post maker plays on a tap (the frame says so in its caption only).
- A picture over the limit is made again smaller (1280 px) before it is given up on.
- The play mark sits on a dark disc so it shows on a pale picture.
- "In the shop from …" is blue and semi-bold on both sides.
- The reason under a grey Send is amber and takes the place of the "Round 2 is the last." hint.
- The picture's own upload is given 30 seconds; if it fails the video simply has no picture.

Return (no board)
- "Until" says the day and the time ("Sun, 11 Oct, 4:30 pm"), because the admin can set the window in
  hours. No sentence on the phone states a number of days.

## Not done, and open

- **Device walk** of everything above.
- **Maestro** mobile flows were not run for this contract.
- P2 — pictures still travel phone → Render → storage (slow after the server sleeps). Own contract.
- P4 — the five videos already live have no picture; they keep the dark tile / product photo.
- P5 — a cash-on-delivery return is paid back by INFLX by hand; INFLX holds no UPI or bank detail for a
  shopper, so the admin has to ask them.
- C12 (a gift follows what earned it on a return) reuses the cancel rule and has no return-specific test.
- The admin's return-window page and Returns page have no automated test; they were walked by hand in
  the local preview only.

## Test runs (4 Oct 2026)

- Phone: `cd Packages/Mobile && npx jest --silent` → 104 suites, 2,410 tests, all passing (was 94 / 2,153).
- Server, this contract's three new suites: return window 12, shop 11, returns 11 — all passing.
- Server, whole suite: see `backend-compare.txt` in this folder.

## Release, when the founder says go (production-impacting — never silent)

1. `node backend/scripts/run-202-203.js --apply` on production (dry run already done: nothing applied
   yet; two undelivered online sales will now wait for delivery).
2. Commit by path, push (Render deploys the server, Vercel the website).
3. Check the server has the new routes, then OTA: brand, influencer, follower — one at a time.
4. Founder's device walk; record what he finds.

Undo: revert the commit and push; publish the previous OTA bundles; the two migrations only add columns
and widen two checks, so they can stay. The return-window number: `node scripts/set-return-window.js --days=30 --apply`.
