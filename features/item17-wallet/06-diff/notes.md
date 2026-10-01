# Diff notes — item17-wallet

Against the locked boards `04-preview/mockups/item17-wallet-apps-v1.html` (BW1–BW10, CW1–CW7) and
`04-preview/mockups/item17-wallet-admin-v1.html` (AM1–AM12). Rules: master business rules v1.31 §17A.

## What was implemented
**Server.** Migration 200 (additive). `withdrawalRequest.service` — one model for both sides:
request (Available → On hold, in one transaction), processed (the hold is taken; bank reference
required), could not process (the hold returns; the reason is what the person reads); one open
request; the minimum; the destination read from the person's own saved details. `walletRead.service`
— every figure from its own source; sales with their three shares; history in plain words (who was
paid, which payment, where a withdrawal went). `settlement.service` — a sale's brand share is added
to the brand's wallet in one transaction; no bank transfer, no cash-order dues. Jobs: a cash order
counts once delivered and its window runs from the delivery; the transfer-retry job does nothing.
`wallet.controller` — a top-up is credited once (order row + unique index). `adminMoney.service` +
`/admin/money/*` — overview, balances, one person, sales, collaboration money, money added (and the
credit-once repair), all movements, and the three by-hand tools. Campaign cancel refused once any
collaboration is signed by both. The old automatic payout, its retry and the two admin approve
endpoints are retired (410). The admin sales summary's broken column is fixed.

**Phone.** Brand: Wallet tab (BW1/BW2), Locked (BW3) and one collaboration (BW4), Sales (BW5) and one
sale (BW6), Withdraw (BW7/BW9), Withdrawals (BW8), History (BW10). Creator: Wallet tab (CW1/CW2),
Collaboration payments (CW3), Commission (CW4), Withdraw (CW5), Withdrawals (CW6), History (CW7).
Withdraw, Withdrawals, History and the details list are one screen each, shared by both sides.

**Website.** Brand Wallet page rebuilt to the same model (four figures, add money, withdraw request
and its outcomes, locked per collaboration, sales with three shares, history, the one bank account).
Admin: a Money section of nine pages replacing Escrow and Payouts.

## What matches the locked boards
BW1 four figures and the two buttons · BW2 the hold box, the On hold figure, Withdraw off, "One
withdrawal at a time." · BW3 per-collaboration cards with the next payment and the campaign-fee note ·
BW4 three payments with dates, still locked, the fee apart, the way to the collaboration · BW5 totals,
filters, one row per item in each state · BW6 shopper paid and the three shares, the state box ·
BW7 amount, quick amounts, sent to, the explanation, "Request ₹X" · BW8 processed with reference,
could not process with reason and "back in Available" · BW9 no bank account / one waiting / under
the minimum / more than available · BW10 plain-word rows with filters · CW1–CW7 the same on her side,
with no tax anywhere · AM1 holding = the sum of its parts, earnings apart, what needs attention ·
AM2–AM4 one queue, the full account only inside Mark processed, reference required, reason presets ·
AM5/AM6 balances and one person's money · AM7 sales and three shares · AM8 collaboration money with
what each waits for · AM9 money added with the credit-once repair · AM10 all movements with search
and download · AM11 three tools, each with a reason, and the list of what was done · AM12 the five
numbers and the TDS switch shown off.

## Where it differs from the boards, and why
- **"Bank and business details" / "Payment details" open a short list** (GST + bank; UPI + bank +
  PAN) one tap in — the rows that used to sit on the tab. The board shows the row, not where it leads.
- **BW6 box wording:** "added to your wallet when it closes" instead of a calendar date for the day
  after — the job runs nightly, and a date the system might miss by a day should not be promised.
- **BW10 / CW7 sub-lines** are built from the row itself (who, which payment, campaign, where it was
  sent). Item names on "Sales money added" are not shown: one credit can cover several items.
- **AM1 bar has five parts**, not four: creators' Available is a part too — without it the parts
  would not add up to the total.
- **AM10 filters** are All / Added / Collaborations / Sales / Commission / Withdrawals / Courier /
  Corrections — the wallets' own groups — rather than the board's "Locked / Paid to creators".
- **An undelivered cash order** is listed but is in no "coming" or "holding" figure: INFLX has
  collected nothing for it yet (rule W4 — it counts once delivered).
- **The brand website** has no board of its own; it carries the phone board's content one-to-one.
- **AM12 saves each number on its own**, through the page that owns it; an admin without the
  Settings permission can read them here but not change them.
- **Device screenshots** (the "after" panels) wait for the deploy: the phone screens are proved by
  render tests today, the website and admin by a walk on a local server.

## Walked on a local server (local database, example data — not production)
Brand website Wallet: figures, hold box, blocked withdraw, withdrawals in all three states, locked
collaboration with its payments, six sales in five states, history. Admin: Overview (parts add up to
the total), Withdrawals (queue; Mark processed shows the full account), Balances (both tabs) and one
person, Sales, Collaboration money, Money added (**"Credit this payment" done through the page: a
reason is demanded, the wallet is credited once, the button goes**), All movements, Disputes &
corrections, Settings. Found and fixed by the walk: undelivered cash orders were counted as "coming";
All movements used generic labels where the owner's history names the person.

## Pre-deploy review (1 Oct 2026) — what it found, and what was changed before any deploy
After the founder's go and before touching production, six independent reviewers read the change
(money and concurrency, queries, who can see or do what, old app versions and deploy order, the
phone, the website); every finding was challenged by a second reviewer. 29 were confirmed (many
were the same defect seen from two sides). Fixed before deploy:

- **A sale could be added to the wallets and then cancelled into a full refund.** The money jobs
  now leave a sale alone while its parcel is still Confirmed or Packed (it can still be cancelled),
  and cancel() refuses a sale whose shares are already in the wallets. The screens say "not shipped
  yet" once such an order's window date has passed.
- **Only shopper-checkout sales become wallet money.** The older pay-at-store / prebook rows (no
  checkout) are never credited, and their four verify endpoints now check the payment signature.
- **A top-up could be credited from any paid order on the account (live mode).** The Razorpay order
  must be an add-money order of that brand (its notes are checked), on verify and on Admin's repair.
- **"Release a locked payment" released whatever was next when it ran.** It now names the payment
  the admin was shown and refuses if that has changed (a second click no longer releases the final
  50%). "Return locked money" checks the amount shown the same way.
- **The dispute tools left the collaboration unable to finish.** Releasing the second 25% by hand
  now does what the brand's confirmation does (the final 50% is queued with its date and completes
  by the normal job); releasing the final 50% completes the collaboration; and the brand's own
  "Confirm it's live" afterwards is refused in plain words instead of crashing. The creator / brand
  is told when INFLX moves money into their wallet.
- **The creator's commission into her wallet is now one transaction, claimed once** (as the brand's
  share already was).
- **Creator History listed commission taken back from her pending balance as a wallet debit.**
  History is the wallet's own movements now; a pending claw-back shows on Commission as "cancelled".
- **Admin figures:** undelivered cash orders left out of the Sales month tiles; "today" and "this
  month" are India's day; All movements filters by kind before the page is cut; add-money attempts
  that were started and never finished are called that (not "paid, not credited"), counted for 7
  days only, and no longer raise the sidebar badge.
- **The older "reserved" figure** (website home, older phone builds) now reads the same escrow rows.
- **Bad input** (an impossible paid-on date, a huge correction, a non-id, odd list values) is a
  field error, not a server error. **Return-window dates** are India's day.
- **Long lists:** Sales (brand) and Commission (creator) have "Show more"; the website too.
- **TEST MODE.** Production payments are simulated today (RAZORPAY_MOCK): money "added" to a wallet
  was never received by INFLX. Admin → Money now says so in red on the Overview, on Withdrawals and
  inside "Mark processed", so nobody pays a withdrawal from the bank for money that never came in.

**Two more independent checks were run on the fixes themselves.** They found, and these were changed:

- INFLX's release of the second 25% counts as the brand's confirmation **only when she has posted
  and the brand has neither confirmed nor reported**. In any other state it is the payment only:
  nothing is promised about the final 50%, which stays locked until INFLX releases or returns it.
  (A brand-reported collaboration could otherwise have been given a date the job would never pay.)
  The dialog says which of the two will happen, and the server refuses if that changed meanwhile.
- When INFLX confirms in place of a silent brand, the screens say "INFLX confirmed…" — never
  "You confirmed" — both wallets' History say "released by INFLX", the brand is told, and the
  collaboration's diary records it.
- After INFLX returns locked money, the content screens show the payments as returned and promise
  no date; while she is "posted" the brand is no longer offered "Confirm it's live".
- "Show more" loads one page at a time (a double tap could double rows).
- A referral earning, if one ever accrues, is a History row.

Left as they are, on purpose (told to the founder): the public Creator Agreement still describes
tax at withdrawal (legal text — the tax round); the admin creator page's TDS controls carry a
"paused" note; an admin who has only the old Escrow permission no longer reaches a page (Money
needs the Payouts permission); what a collaboration ENDS as after INFLX settles it by hand outside
the one clean case (she posted, the brand was silent) is the dispute's outcome — item 18: until
then such a collaboration stays open (a Hybrid one does not complete by itself, and the brand's
confirm reminders are not switched off).

## Assertion drift recorded (the rule changed; no test was skipped or deleted)
`brand-withdrawal` (8) · `withdrawal` (3 renamed) · `settlement` (5) · `settlement-retry` (3) ·
`shopper-ordering` C32 and 6.13 · `item12-phase2a` check 34 · `item6-negotiation` settings list ·
mobile `brandWallet` W1·W2, `creatorWallet`, `registrationProfile` C7·B8. Each file carries a note
naming rule v1.31 §17A and the decision. One stale fixture fixed on the way: the finance admin in
the two withdrawal suites had no `payouts` capability, so three approve tests had been failing since
migration 109.

## Test record (final, after all three review rounds)
- Backend `tests/item17-wallet.test.js` 31/31. Full-run compare vs `backend/baseline_item17.json` (item 15's
  committed run): before 135 suites / 1786 tests / 1577 passed / 181 failed → after 137 / 1831 / 1625 / 178.
  **Newly failing 0.** New 67 (67 passing). Gone 22 — 20 RENAMED by the recorded item 17 drift
  (brand-withdrawal 8, settlement 5, settlement-retry 3, withdrawal 3, shopper-ordering 6.13); the other 2
  and one of the new suites belong to another window's offers work that shares this tree. The three fewer
  failures are the stale-fixture approve tests, now passing under their new names.
- Mobile: 63 suites / 838 tests green (`wallet17` 27; content and sale screens +7 for the by-hand states).
- Migration 200 rehearsed on the local base database: applied, 17/17 checks, no money moved; second
  apply idempotent. Production dry run (read only): clean — see `05-impact.md`.
- Website + admin: walked twice on a local server against the local database (before and after the
  review fixes), including "Credit this payment" and "Release a locked payment" done through the pages.
- Three independent review passes (51 reviewer/verifier runs in all); every confirmed finding is fixed
  or listed above as left on purpose.
