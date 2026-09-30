# item15-hybrid — spec

**Item 15 of 21: Hybrid.** Master rules **v1.30** §12.1 (the Hybrid lines), §19, §21, §23, §3, §10,
§25, §26. Builds on **item 14** (`features/item14-sale-going-live`: the two paths, `saleLive`,
`contentGate` sale arm) and **item 12** (`contentMoney.releaseSecond / releaseFinal`, the tranche-3
job, the creator's brand-silence report). No new table is expected.

## State today (verified 30 Sep 2026)
- Hybrid terms, signing, the lock of the fixed amount (no campaign fee) and the **first 25% at
  signing** are built (items 7, 9).
- After the shoot, Hybrid is refused by `contentGate` (404 `NOT_PAY_FOR_CONTENT`); T2 and T3 can
  be released only by the Admin manual release; nothing completes a Hybrid collaboration.
- `contentMoney.releaseFinal` marks a collaboration Completed as soon as every escrow row is
  released — for Hybrid that must also wait for the minimum of approved posts.
- Production: 2 Hybrid collaborations, both **old terms**, ₹9,375 locked — test data (founder).

## Founder decisions (30 Sep 2026)
| # | Decision |
|---|---|
| H1 | The two old-terms Hybrid collaborations are test data: nothing is built for them. |
| H2 | The final 50% is paid on its stamped date even if the minimum is not yet approved; only "Completed" waits. |
| H3 | The wait before the final 50% is the existing `final_payment_wait_days` (7), shared with Pay for Content. |
| (v1.30) | Same two paths as item 14; the live confirmation releases the second 25% and stamps the final 50%; it never confirms itself; after `content_report_silence_days` of silence she may tell INFLX (records, moves no money, freezes nothing). |

## The rules item 15 delivers
1. `contentGate` admits a new-terms **Hybrid** collaboration exactly as it admits Pay for Sale
   (Path 1 gate, rows she names, outside rows, links) — item 14's code, widened by Aim.
2. **Confirm live = a money write** (item 12's G10): escrow `FOR UPDATE`, `contentMoney.releaseSecond`
   (second 25%, final 50% queued with `release_due_at` = IST day + `final_payment_wait_days`), the
   amount on the button must match (`AMOUNT_CHANGED`), refused when reported or ended.
3. **Never self-confirms.** "Posted" stamps `content_report_silence_days` / `report_after_at`, not
   `autoconfirm_at`. From that date she may report `brand_silent` (freezes nothing).
4. **Final 50%** by the tranche-3 job on its stamped date, whatever Path 1 shows (H2).
5. **Completed** = all three escrow rows released AND the minimum approved, whichever is last —
   from the tranche-3 job, from item 13's approval hook, or the hourly sweep. Campaign completion
   rule unchanged.
6. **Brand report** freezes the step; the tranche-3 job already skips a reported collaboration;
   the locked money stays until INFLX settles it. Shop posts stay in the shop.
7. Delayed, reminders, lists and doors: item 14's, widened to Hybrid.
8. Screens: item 14's screens plus the fixed-amount payments card on both sides, the confirm
   button naming the amount, her "Ask INFLX to look", paid-in-full-waiting-on-posts, completed.
9. Admin: no new number; the two descriptions say they apply to Hybrid.

Not in item 15: old-terms Hybrid (H1); disputes resolution (item 18); wallet screens (item 17).
