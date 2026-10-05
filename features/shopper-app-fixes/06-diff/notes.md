# Diff notes — shopper-app-fixes

Against `01-spec.md` (fifteen faults F1–F15, eight small ones N1–N8, approved by the founder on 5 Oct
2026) and the board `04-preview/mockups/shopper-app-fixes-mockups-v1.html` (18 frames; a record of
what changes on screen, locked under his instruction to fix these — he has not reviewed the board).

## Where this stands — read this first

- **Nothing here has been seen on a phone.** Every phone line is from the code and from jest. Jest
  cannot see a video, a swipe, a payment sheet, a notification arriving, or how a screen looks. A
  device walk is owed for every row of `03-expected-outputs.md` section B. No after-shots.
- **Released on the founder's go of 5 Oct 2026** ("Pls go and release"): this commit (server), then the shopper app update. The record is in `lock.json` → `deployed_to_production`. Released without a device walk — he chose to release and walk after.
- This file existing is what the release gate (Rule 4) looks for. **It is not the diff sign-off.**

## What was done

All fifteen faults and seven of the eight small ones, on the server and in the shopper app:

- **Paying online (F1).** The bag is emptied only when the order is really placed. Cancelling or
  failing the payment releases the held items at once. A payment that lands after the items have
  gone says it is being refunded, never "Order placed". And when she HAS paid but the app cannot
  reach INFLX, it tries three times and tells her not to pay again, with "Check again" (X10).
- **Signing in (F2, F4, N2).** Any ten digits sign in; a first-time shopper is asked her name once;
  the screen says why she is signing in; "Resend code" after 30 seconds.
- **Staying signed in (F3).** The session is renewed before a request when it has run out.
- **Play (F5, F8).** She comes back to the video she left; a video opened from a store or search
  opens on top with a Back arrow.
- **Stock and prices (F6, F10).** Sold out in every size reads "Out of stock" everywhere and the post
  leaves the shop when everything in it has sold out; a size's own price shows when she chooses it.
- **Bag and deal (F9, F12, N6, N7).** The bag icon has its number from the start; a bag that cannot be
  read says so and nothing is saved over it; "Your deal" never spins for ever; a gift shows once.
- **Her account (F13, F14, F15).** Profile's lines are true; Following and Notifications open plain
  lists; likes and hearts stay as she left them; every saved product has Remove; a notification about
  an order opens that order.
- **Small ones (N1, N3, N4, N5).** An ended post says so; "To pay ₹X on delivery" until delivered;
  "No order matches …"; Packed and Out for delivery filters; lists carry on at their end.

## Not done

- **N8, the refund policy sentence** ("you do not have to give a reason", while Cancel asks for one).
  The policy inside the app is produced from the website's policy and a check fails if they differ,
  so it can only change together with the website's legal text. Left for the founder to decide which
  side changes (X9). The collection's contradicting sentence, the other half of N8, is gone.

## Where the build departs from the spec's first words

- **N6.** The bag now has no delivery line at all: the server sends no delivery amount with a bag.
  Review order shows the server's amount. (The spec first said the bag's line would show it.)
- **F13.** A guest has no Returns row (it opens My orders, which exists only for a signed-in shopper).
- **F11** also reloads Play when her Welcome choices changed (with F5 fixed it would otherwise keep
  the old ones until the app restarts).
- **F3.** The app also corrects for a phone clock that is set wrong, so a fast clock cannot make it
  renew the session before every request.
- **F4.** What a guest had saved or followed is moved to her account right after the code, before the
  name step, so leaving at "Your name" loses nothing.
- **N1.** "Ended" is recognised by the server's "not found" answer with its sentence.
- **F9.** If reading the bag signs her out for good, she quietly gets the phone's own bag.
- Order lists that cannot be read say "Couldn't load…" with Try again instead of "No orders yet".

## Second pass, 5 Oct 2026 — the seven small faults found on the way

The founder: "Seven small faults found on the way… fix the small issues, after that we start Design
round." All seven are fixed (01-spec.md §2b, S1–S7): addresses that cannot be read; Try again on Order
placed, Order details, Cancel, Return and a collection; what a cash parcel really collects; a video
link opening Play once; "sign in" for one page no longer signing her out; one call written once.
Phone 113 suites / 2,644 tests; the server suite 17/17. **Released on his go of 5 Oct 2026** ("pls relase these") — server
(one added field on an order's details) and the shopper app update; no migration.

Deployed 5 Oct 2026: commit `3f7d68b4`; shopper app update **235** (brand 242 and creator 231 not
touched). The update was read back from the live server and carries this pass. The server's part — the
parcel sentence inside a signed-in shopper's order details — cannot be read from outside, so it is not
proved from outside; an older server sends no parcel and the phone shows the item's price as before.
To check on the phone (open the app twice first): a cash-on-delivery order with two items — each
item's page says its price and, under it, "For this parcel you pay ₹… on delivery: 2 items ₹… + cash on
delivery fee ₹…"; and with no network, Order details and Cancel show Try again.

## Test runs (5 Oct 2026)

- Phone: `cd Packages/Mobile && npx jest --silent` → 110 suites, 2,624 tests, all passing (was 104 / 2,410).
- Server, this contract's suite: 15/15; the eight neighbouring suites 175/175.
- Server, whole suite: see `backend-compare.txt` (144 suites, 1,951 tests; nothing that passed before
  fails now; the same 177 old failures).
- Each phone build put its fixes back to the old behaviour one at a time (38 in all) and confirmed
  the new tests then fail.

## What to check at the walk (after release; close the app fully and open it twice first)

- Place order → pay online → close the payment sheet: "Payment cancelled", the bag still has the items,
  Place order works again straight away.
- Sign out and in: the name step for a new number; "Resend code".
- Leave the app open 20 minutes, then open Comments and Saved: still signed in.
- Play: swipe a few, open comments, come back — the same video. Open a video from a creator's store:
  Back returns to the store.
- Profile: Orders line, Following list, Notifications list, Returns row.
- Like a post on Home, open it: still liked. Saved › Products: Remove.
- Reopen the app: the bag icon has its number.

## Release, when the founder says go (production-impacting — never silent)

1. Commit by path, push (the server; the website host redeploys the same pages).
2. Check the server has the new route (`POST /v1/follower/checkout/:id/abandon` sits behind sign-in, so
   it cannot prove the deploy; the proof is the guest feed's products carrying the new stock flag, or
   `GET /v1/follower/posts/:id/deal` sizes carrying `shopper_price`).
3. Publish the shopper app update only (brand and creator apps are not changed by this round).
4. Founder's device walk.

Undo: revert the commit and push; publish the previous shopper bundle (233).
