# Before / after

There is no browser to photograph these in — they are React Native screens, and the mobile
screenshot lane (Maestro) needs a connected device. So this is written honestly as a comparison
against the locked boards in `04-preview/mockups/one-basket-add-creators.html`, with the
automated checks that stand in for each panel named beside it.

| Board | Built | Proven by |
|---|---|---|
| **AFTER 1** — footer shows faces + "5 selected" + Review | yes, `pick-footer` / `pick-basket` / `pick-count` | one-basket check 1 |
| **AFTER 2** — the footer survives the Groups tab | yes; `tab !== P.tabs[2]` gate deleted | check 1 asserts `pick-footer` is present **on** the Groups tab — the exact thing that used to be missing |
| **AFTER 2** — group rows say what they contribute | yes, "12 creators · 2 already selected" | check 9 |
| **AFTER 3** — "Add 7 to selection", overlap named first | yes; `startDraft` replaced by `addToBasket` | checks 2, 3, 4, 5 |
| **AFTER 4** — back on the picker, count grown, toast | yes, via `navigate('BrandSetPickCreators', { toast })` | check 3 asserts the route AND the words |
| **AFTER 5** — the Review sheet, grouped by source, removable | yes, `BasketSheet` | check 9 |
| **AFTER 6** — source per creator on Review and send | yes, as a line under the terms | check 8 |

## Two deviations from the boards, both deliberate

**1. The group rows do not say "9 can be invited".** Drawn, then cut before the lock. That number
comes from `groupCheck`, which runs the full creator-scoring CTE plus the eligibility pass **per
group**; asking it for every group on the tab would undo the load-time fix of 2026-09-16. The
rows say what the phone knows for free — how many of that group are already in the basket. The
"can be invited" breakdown still exists, inside the group check, where it is paid for once.

**2. The source on Review and send is a line, not a right-hand tag.** The board drew a tag on the
right of the row. That slot already carries her status — OK / Below min / Can't invite — and two
chips would compete. It reads "from Diwali shortlist" under the terms instead.

## Two things the boards did not cover, found while building

A basket that outlives one screen has to be emptied at the right moments, or Add creators greets
her with a dozen people the server would now refuse.

- **A sent basket is a spent basket** — cleared alongside the draft on a successful send
  (check 13).
- **Removing a creator from the draft removes her from the basket** — otherwise "Remove 2 and
  send the rest" would put them back on the next visit (check 14).

Neither is visible on any board. Both are real rules, and both are now asserted.
