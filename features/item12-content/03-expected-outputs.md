# item12-content — expected outputs: the 46 checks

Checks 1–29 are the gap-check prompt's §12.1; 30–46 are the approval's §4.1. Each names the test
that proves it. Status is filled in Phase 4 from a real run — never by hand.

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | The content step opens only when the shoot is done, for both modes, and only for Pay for Content. | | |
| 2 | The deliverable rows come from the agreement and cannot be added to, removed or edited by either side or the API. | | |
| 3 | Every file limit is enforced on the server: type, size, count per row, caption length. | | |
| 4 | An incomplete package cannot be submitted, from the app or the API. | | |
| 5 | Submitting locks the package; adding, replacing or removing during review is refused. | | |
| 6 | Approving with no rounds used, after one round, and after the last round all work and record who and when. | | |
| 7 | A change request without a reason is refused; with one, it reopens the package and keeps the round. | | |
| 8 | The rounds limit is the number stamped at her first submission; changing the Admin number afterwards does not move it. | | |
| 9 | On the last allowed round the brand is warned before deciding. | | |
| 10 | A change request beyond the limit is refused by the API; only approve or report remain. | | |
| 11 | Approval locks the content; no file can change afterwards. | | |
| 12 | A link is required for every deliverable, a screenshot for every Story row, before she can confirm she posted. | | |
| 13 | The brand cannot confirm live before she confirms she posted. | | |
| 14 | Confirming live releases exactly the second 25%, from the locked amount, with nothing deducted, and stamps the waiting period. | | |
| 15 | There is no path that auto-confirms "live". | | |
| 16 | After the stamped silence period she may report; before it, the report is refused with the date. | | |
| 17 | Reporting `posted_wrong` records a dispute and moves no money. | | |
| 18 | The job releases the final 50% at the stamped due, marks the collaboration Completed, and tells both sides. | | |
| 19 | Changing the waiting-period number afterwards does not move a stamped due date. | | |
| 20 | Two taps, or two devices, produce one submission, one verdict, one confirmation, one release. | | |
| 21 | No money moves anywhere in item 12 except those two releases — proved by balances, escrow rows and both ledgers before and after a complete run. | | |
| 22 | Past the posting date the collaboration is flagged Delayed with the correct content stage, both told once, and everything stays usable. | | |
| 23 | Needs You shows the right move to the right side at each of the five points. | | |
| 24 | Each unanswered move is reminded once at 48 hours and not again within 48 hours. | | |
| 25 | A file is served only to the owning brand, that creator, and Admin on a dispute; every other request is 404, and signed URLs expire. | | |
| 26 | Another brand's or another creator's content, files, links or actions return 404. | | |
| 27 | Loading, empty and couldn't-load states appear on both sides' content screens. | | |
| 28 | Every confirm sheet honours `busy`. | | |
| 29 | Backend tests show no new failures against `baseline_item12.json`. | | |
| 30 | Her fee alone is split; the campaign fee never appears in her card, never in her split, and never in a release. | | |
| 31 | "Still locked" is computed from escrow rows: ₹9,000 before the second payment, ₹6,000 after it, ₹0 once complete. | | |
| 32 | The legacy `confirm-live` route, and all seven others, refuse for every Aim — proved by a loop, with one case per Aim. | | |
| 33 | Changing `final_payment_wait_days` after a confirmation does not move a stamped due date; a new confirmation uses the new number. | | |
| 34 | A collaboration with a queued tranche cannot be cancelled through the campaign-cancel path, and says why. | | |
| 35 | The manual admin release refuses `disputed` and `refunded` rows and writes an audit row with a reason. | | |
| 36 | The four adjacent defects are fixed: no false low-wallet SMS, a queued tranche still counts as pending for her, "still locked" is right, and a notification failure never loses completion. | | |
| 37 | Round history is returned to both sides, with reasons, verdicts and file ids, for every round. | | |
| 38 | Every proof slot must be filled before "posted"; a row of two needs two. | | |
| 39 | A brand report freezes every write with one message; her `brand_silent` report does not, and the brand can still confirm and pay. | | |
| 40 | A `brand_silent` report notifies the brand. | | |
| 41 | The sweep deletes an unconfirmed orphan and never a file referenced by any round. | | |
| 42 | An agreement with no deliverable rows refuses the step with Q7's sentence. | | |
| 43 | A collaboration flagged Delayed at a shoot stage shows the current content stage afterwards, and is notified only once. | | |
| 44 | Content reminders continue past the posting date, every 48 hours, and stop on the move, a report or completion. | | |
| 45 | A 200 MB MP4 uploads from a real phone, is verified by `headObject`, and a file whose real size or type differs from what was declared is deleted and refused. | | |
| 46 | A story screenshot obeys the photo rules and is served only through G12. | | |
