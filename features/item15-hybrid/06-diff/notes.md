# Diff notes — item15-hybrid

Against the locked board `04-preview/mockups/item15-hybrid-mockups-v1.html` (S1–S9, A1).

## What was implemented
Hybrid runs item 14's two paths: `contentGate` sends `hybrid` down the sale arm (`g.hybrid`);
`saleLive` (move SQL incl. `final_payment`, Delayed, reminders, completion sweep) widened by Aim;
`completeIfDue` needs all three escrow rows released for Hybrid. `contentFlow`: posted stamps item
12's silence date (never `autoconfirm_at`); confirm live runs item 12's money path
(`contentMoney.releaseSecond`, amount check); her `brand_silent` report allowed; `shapeSale` keeps
item 12's money block plus `hybrid` and `paidInFull`. `contentMoney.releaseFinal` pays the final
50% on its date and lets `saleLive.completeIfDue` decide completion (H2). Tranche-3 notices open
Going live. Two setting descriptions widened. No migration. Phone: `FeeCard12` on both screens,
"Confirm it's live · ₹X" sending the amount, "Ask INFLX to look", second-in / last-on / paid in
full, the locked amount on a report, "She told INFLX"; Go live doors for Hybrid on both shoot screens.

## What matches the locked mockup
S1/S2 payments card (paid, next, last; still locked for the brand; no campaign fee) · S3 the amount
on the preview and the button · S4/S6 second payment in, last on a date · S5 no self-confirmation,
"No answer by … you can ask INFLX to look" · S7 paid in full, completes when the minimum is approved ·
S8 completed with the fee card and the sales split · S9 reported (locked stays locked), she told
INFLX, Delayed · A1 descriptions only.

## Where it differs
- After screenshots on the device wait for a production Hybrid collaboration on the new terms
  (the two in production are old-terms test data, H1).

## Test record
- Backend `tests/item15-hybrid.test.js` 9/9. Full-run compare vs `baseline_item15.json` (item 14's
  committed run): before 134 / 1777 / 1568 passed / 181 failed → after 135 / 1786 / 1577 / 181.
  **Newly failing 0.** New 12 (12 passing). Gone 3 — all RENAMED by the recorded item 15 drift
  (Hybrid now reaches the two paths) in item14-sale, item12-flow, item12-phase2a.
- Mobile: 62 suites / 804 tests green (saleLiveScreens 17/17).
