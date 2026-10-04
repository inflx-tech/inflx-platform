# shopper-walk-fixes — the founder's walk of 3–4 Oct 2026

**Status:** LOCKED by the founder, 4 Oct 2026 ("previously drawn screens are locked… then start building… start build in sequence"). Board: `04-preview/mockups/shopper-walk-fixes-mockups-v1.html`. Build order: `02-workflow.md`; what the server sends: `BUILD_API.md`.
**Findings and evidence:** `Docs/SHOPPER_AND_GOING_LIVE_WALK_REPORT_2026-10-03.md` (every cause, with file and line, and what was read on the live system).
**Rules touched:** `Docs/OFFER_TERMS_POSTS_RULES.md` §5.5–5.7 (feed and Play), §6.5–6.6 (deal page, bag). Boards this continues: `features/follower-app-v2` (F2–F12), `features/shopper-ordering` (final, locked 30 Sep 2026), `features/item14-sale-going-live` (board v2), `features/ui-walk-fixes` (board H, the viewer).

## 1 · What the founder reported, and what will change

IDs are the ones used with him in chat on 4 Oct. "Frame" is the board frame that shows the change.

### Shopper app — video
| ID | Today | After | Frame |
|---|---|---|---|
| V1 | Tapping a video in a feed only pauses and resumes it. | The tap opens it full screen in Play; it plays first, then every creator's videos. Pause stays inside Play. | V1, V2 |
| V2 | After a swipe in Play the previous video's sound runs on for 2–3 s. | The video that plays changes the moment the swipe lands. The one-second rule stays for counting a post as seen, and for nothing else. | V2 |
| V3 | A saved video post shows one of its product photos. | It shows a picture taken from the video itself. Same on every tile and row that stands for a video. | V3 |

### Shopper app — ordering
| ID | Today | After | Frame |
|---|---|---|---|
| O1 | A plain discount post shows "Build your deal" for about 2 s, then it goes. A tap in those seconds opens the deal page. | Never shown on a discount or price post. | S1 |
| O2 | "Shop this post" is a list with 40 × 50 thumbnails. Tapping a row starts adding. | "Products in this post": a grid of three with large photos; a bag icon on each (quick add); the heart stays; tapping the photo opens the product page. | S1, S2 |
| O3 | A product shows colour, size and its description in one grey line. On a discount post there are no photos or details at all. | A product page: photos, name, price with the offer, colour, size, then everything from the listing in a fixed order, then the description. The deal page's product pop-up shows the same details block. | S3, S4 |
| O4 | Pictures are slow or missing. | Not a screen change. Its own piece of work — see §3, P2. | — |
| O5 | The sentence under a deal speaks to the creator ("They buy… from your post"). All ten offer kinds. | Ten sentences in the shopper's voice. The creator's terms screen keeps its own. | S2, table T |
| O6 | A deal's "Add to bag" opens the Bag. A discount post's leaves her on the pop-up. No vibration. No bag icon on Play or the deal pages. | Add to bag → added → short vibration → the button reads "Go to bag" for about a second → she is returned, by itself, to exactly where she was. A bag icon with its count on every browsing page, Play included. Buy now is unchanged. | S5, S6, S7, V2 |
| O7 | In the bag every paid item has − 1 +, deal or not. Raising one item of a set gives "Sold only as the whole set" and blocks Continue. | A deal made of fixed pieces is one group: no − 1 +, no Remove on a single item, one tick for the group, "Edit deal" and "Remove deal". This is what the locked board drew on 30 Sep (D11); the build departed from it. | G1, G2 |

### Brand app
| ID | Today | After | Frame |
|---|---|---|---|
| B1 | A video to check shows "Update INFLX to play videos". | No code. The brand app on the founder's phone predates the 30 Sep build; installing that build plays it. | — |
| B2 | Posts are empty grey squares; files to review are black tiles. | Each shows a picture taken from its video. | B1 |
| B3 | "4 of 1 approved". | "4 approved" with "Minimum 1 met". Below the minimum it reads "1 of 2 approved" as now. | B1 |
| B4 | The viewer's title is cut in the middle. | Two lines: the post, then the place and "1 of 1". | B2 |

### Creator app
| ID | Today | After | Frame |
|---|---|---|---|
| C1 | Her posts are empty grey squares; her uploaded videos are black tiles. | A picture from each video. | C1, C2 |
| C2 | While making a shoppable post the uploaded video is an empty tile, then "▶". | A picture from the video, with its length. | C3 |
| C3 | "4 of 1 approved". | As B3. | C1 |
| C4 | "Approved" beside "Live", with no reason. | "In the shop from 4 Oct" under the approved post (the brand already sees it). | C1 |
| C5 | "Send to Aveen fashion boutique and desiner studio" breaks into two left-aligned lines. | One centred line; a long name is shortened with "…". | C2 |
| C6 | Every post appears twice with nothing to say why. | The lower list gets a heading: "Share another post, or another place". | C2 |
| C7 | Send is grey with no reason when a row has no file. | A line under the button names the row that needs its file. The row's chip reads "No file yet" / "1 file". | C2 |

## 2 · Decisions

**The founder's (4 Oct 2026, chat)**
- **W1.** The bag count and the greyed Continue are not problems. Withdrawn; nothing is changed for them.
- **W2.** O7: lock the count where the deal is made of fixed pieces — the set, the bundle (pick any, mix & match), buy one get one. Leave it free where buying more is the point — buy more save more, spend or buy for a gift — and on a plain discount. ("Your recommendation is fine.")
- **W3.** O6: where she lands after adding — "either way is fine because he has to continue the shop". Taken as: exactly where she was (the same post in the same feed, the same video in Play).
- **W4.** O2: the reference picture he sent (3 Oct) is the expected products pop-up. Per his standing rule a reference shows capability, not exact spec: the grid of three, the bag icon on each product, the full product page, Back to the sheet.

- **W11 (4 Oct 2026, later).** The return window is INFLX's, one number for the whole platform, never a brand's or a product's: "this return window is fixed by our platform INFLX… same for all… not decided by individual business or brand… 7 days for now… given to admin as a setting". This also answers item 7's open question (30 or 7).
  - **Done on live, 4 Oct 2026** (`backend/scripts/set-return-window.js --days=7`; dry run, apply, second dry run): the platform number (Admin › Money › Settings › "Return window") 30 → 7, and the same number on all 16 categories, because the category's number wins over the platform's in today's code and neither box can be left empty. Checked before and after: the 18 sales already made keep the window stamped on them, the 11 sent agreements keep their terms, no wallet moved.
  - **What 7 days now governs, for anything from now on:** how long after delivery a sale's shares wait before they reach the creator's and the brand's wallets; the "commission after N days" line of an agreement sent from now on.
  - **For the build:** the code reads the platform number only; the "Return window" box leaves Admin › Pricing › Categories; the product's own "return days" is no longer read anywhere (all 62 are 0; nobody set it); the product page says "Returns · Within 7 days of delivery" from the platform number; the older returns check (`returns.controller.js:80`) uses it too.

- **W12 (4 Oct 2026, the lock).** "previously drawn screens are locked… start build in sequence". The 17 frames and table T are the screens to build.
- **W13 (4 Oct 2026).** "as an admin we can set any number of days even 24hrs or any hours to days as a return window… that power is in admin… after delivery sale commission to creator, platform sale percentage, and money return to brand all should follow the time set in admin for return window".
  - The admin sets the window **in hours or in days**, 1 hour to 365 days, in one place (Money › Settings). It is kept in hours (`payment_config.return_window_hours`, migration 202).
  - **After delivery** — for every order, paid online or in cash — the window runs, with the length stamped on the sale when it was made. When it closes, the creator's commission and the brand's money are added to their wallets and INFLX's share counts as earned. The two money jobs run **hourly** (they ran once a night).
  - **This changes an item 17 rule.** Until now only a cash order waited for delivery; an online sale was added once it had shipped and its date (counted from the ORDER) had passed. My message to him earlier on 4 Oct ("7 days after delivery") was true for cash orders only; it is true for all orders from this build.
  - The category's own return window is no longer read, and its box leaves Admin › Pricing › Categories. The product's own "return days" is no longer read.
- **W14 (4 Oct 2026).** "as well as build return option for shopper as well… no need to draw screens now for return… we build at end". Built last, with no new board; it follows the Cancel screens (O16, O17) and INFLX's existing Returns page. Its rules are the ones INFLX already had, none invented:
  - when: a delivered item, inside the return window counted from its delivery;
  - what: an item; a deal's items go back together and a gift follows what earned it (the set a cancel takes);
  - who decides: INFLX's admin (approve / reject with a note / mark refunded once the item is back). The brand sees it and is told; it does not decide;
  - money: while a return is open the sale's three shares wait. Refunded → the item is undone exactly as a cancel undoes one, and an online payment is refunded to where it came from. A cash-on-delivery order is paid back by INFLX by hand. Rejected → nothing changes.

**Mine, under his standing "take your best decision" (each can be reversed at the lock)**
- **W5.** Nothing is drawn that the system does not hold. The reference's star rating, review count and "Inclusive of all taxes" are left out: INFLX has no ratings and no tax line. A struck price is drawn only where an offer lowers the price (the MRP box is empty on every live product).
- **W6.** The product page lists details in this order, skipping what the listing left empty: Brand · Category · Fit · Neck · Sleeve · Material · Pattern · Occasion · Care · any other listed detail in the listing form's own order · Returns (INFLX's window, W11) · Description · the store and the creator's post it is sold through.
- **W7.** On a deal post the product page's button is "Build your deal" (it opens the deal page with this product started), as "Add" does today — a deal item is never added alone.
- **W8.** On a deal group in the bag, "Remove" removes the whole deal, and there is one tick for the group. A single item's colour or size changes through "Edit deal".
- **W9.** The quick-add size sheet (O1 of the locked board) stays: the bag icon on a product opens it. The product page is the photo tap.
- **W15 (replaces open point P1).** A video's picture is made **on the creator's phone when she uploads it** and sent with it. I had told him that needs a new creator app build; it does not — the library that shrinks her videos (already inside the 30 Sep builds) also takes a picture. So: no new build, no new server software. A video uploaded before this, or from an older app build, has no picture and shows the dark tile with the play mark (never a blank box, never a product photo on the brand's or creator's screens).
- **W10.** After the button's "Go to bag" second, a discount post closes the pop-up and the sheet; a deal closes the review and the deal page. The bag icon's count is the only thing that changes on the page she returns to.

## 3 · Still open (the founder's)
- **P1 · Where a video's picture comes from — CLOSED by W15** (the creator's phone, with what is already in the app build).
- **P2 · How pictures reach the phone (O4).** Today each picture first asks INFLX's server where the file is (0.5–1 s; 53 s after the server has slept). The fix is to serve product photos and approved posts from a public picture address, and to keep the server awake. Both are hosting changes and may cost money; it is its own contract.
- **P3 · The Return button — CLOSED by W14** (built in this contract, last).
- **P4 · The five videos already on live have no picture.** They were uploaded before her phone made one. They show the dark tile with the play mark on the brand's and creator's screens, and a product photo on the shopper's tiles (as today). Re-uploading a post gives it a picture; filling the old ones in by hand is possible and not done.
- **P5 · A cash-on-delivery return is paid back by hand.** INFLX needs the shopper's UPI or bank details for that; the app does not ask for them yet.
  What was found about the old per-product number:
  Facts read on 4 Oct 2026: all 62 live products hold 0, and 0 is what the database writes by itself (`migrations/047`, `DEFAULT 0`). The add-product pages on the brand website have no box for it (the old schema `backend/public/schemas/fashion.json` has "Return window (days)", 0–30, and the Excel sheet has the column). The older returns code refuses a return when the number is 0 (`returns.controller.js:80-83`, "This product is not eligible for returns"). The new shopper app has no return screen (left out of the 30 Sep step on purpose), yet a shipped order says "It has shipped. You can return it once delivered." (`copyOrder.js` `cancelClosed`). No return has ever been asked for on live.

## 4 · Not in this contract
- P2 above (picture delivery).
- Installing the 30 Sep builds (B1) — his action.
- The bag's count and Continue (W1).
- Ratings, reviews, a tax line, a wish-list beyond the heart that exists.

## 5 · What it touches — see `05-impact.md`
