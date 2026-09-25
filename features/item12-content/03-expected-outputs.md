# item12-content — expected outputs: the 46 checks

Checks 1–29 are the gap-check prompt's §12.1; 30–46 are the approval's §4.1. Each names the test
that proves it. Status comes from the final full run (`baseline_item12.json` compare) — never by
hand. Backend suites: `item12-phase2a` (P), `item12-storage` (S), `item12-flow` (F), `item12-jobs`
(J). Mobile: `content12` (M1), `contentScreens` (M2), `duplicateScreens` (M3), `uploadProbe` (M4).

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | Opens only when the shoot is done, both modes, only Pay for Content | P "the content gate — every case" (visit, Remote, brand-only legacy mark, Sale/Hybrid 404, unsigned/unfunded); F "every content route asks the gate" (all 12 routes × Sale, Hybrid, shoot not done, unfunded) | pass |
| 2 | Rows from the agreement; nobody can add, remove or edit them | P "the rows come from the SIGNED snapshot"; F "what she owes comes from the agreement and nowhere else" (live terms changed → rows unchanged; no row route) | pass |
| 3 | Every file limit on the server: type, size, count, caption | S "every file limit, on the server" (type, kind, 10 MB / 200 MB boundaries, 11th file, unknown row); S "what landed differs … deleted and refused"; F "3 · a caption is optional and at most 500 characters" | pass |
| 4 | An incomplete package cannot be submitted | F "4 · nothing, or part, cannot be sent; the whole package can" | pass |
| 5 | Submitting locks it; add/replace/remove refused in review | F "5 · while it is with the brand she cannot add, remove or re-caption" | pass |
| 6 | Approve with no rounds, after one, after the last — who and when | F "6 · approve with no rounds used"; F "8, 9, 10, 37 …" (approves after the last round) | pass |
| 7 | No reason → refused; with one → reopens, round kept | F "7 · a change request needs a reason …" | pass |
| 8 | The limit is the number stamped at her first submission | F "8, 9, 10, 37 …" (setting changed to 5 after the stamp → still 2) | pass |
| 9 | On the last round the brand is warned before deciding | F (round.isLast on the brand's read); M2 "C9 · the last round, warned before the decision" | pass |
| 10 | Beyond the limit the API refuses; only approve or report | F "8, 9, 10, 37 …" (ROUNDS_USED, "both"); F "10 · the rounds wording … all 3 rounds"; F "rounds_used is open only once the rounds are used"; M2 "C14" | pass |
| 11 | Approval locks the content | F "11 · approval locks the content" | pass |
| 12 | A link per deliverable, a screenshot per Story row, before "posted" | F "links are checked for shape and platform; a Story takes a screenshot; every slot before posted" | pass |
| 13 | No confirmation before she posts | F (same test: NOT_POSTED before "posted") | pass |
| 14 | Confirm live releases exactly the second 25%, nothing deducted, wait stamped | F "₹12,000: releases exactly ₹3,000, stamps the waiting period …" | pass |
| 15 | No path auto-confirms "live" | F "only the brand's own confirmation ever writes live_confirmed_at"; F "every job, run long after she posted, leaves it unconfirmed" | pass |
| 16 | After the stamped silence she may report; before, refused with the date | F "16, 39, 40 · brand_silent …" | pass |
| 17 | posted_wrong records a dispute, moves no money | F "17, 39 · posted_wrong records a dispute, moves no money …" | pass |
| 18 | The job pays the final 50% at the due, Completed, both told | J "18 · not before the due; at it: released, Completed, both told — once" | pass |
| 19 | Changing the number afterwards does not move a stamped due | J "19, 33 · changing the number after a confirmation moves nothing …" | pass |
| 20 | Two taps / two devices: one submission, verdict, confirmation, release | F "20 · two taps, two devices: one submission"; F "20 · two devices approving"; F "20 · two devices confirming"; J "20 · two runners at once: one release" | pass |
| 21 | Only the two releases move money — balances, escrow, both ledgers | J "a complete run, from shoot done to Completed …" | pass |
| 22 | Past the posting date: Delayed with the content stage, told once, usable | J "22 · past the posting date …" | pass |
| 23 | Needs You: the right move to the right side at the five points | J "send → review → changes → post → confirm"; J "the legacy deliverables rows are no longer counted" | pass |
| 24 | Reminded once at 48 h, not again within 48 h | J "47 h no · 49 h yes · 50 h no · 97 h yes …" | pass |
| 25 | Files only to the owning brand, that creator, Admin on a dispute; URLs expire | S "her own file: yes, for 300 seconds; the brand: not until she sends it; everyone else: 404"; S "a view URL expires"; S "never under the public /uploads folder" | pass |
| 26 | Another brand's / creator's content, files, links, actions → 404 | P "26 · another brand, another creator … all 404"; F "26 · another brand and another creator meet 404 on every route"; S (file URLs) | pass |
| 27 | Loading, empty and couldn't-load on both content screens | M2 "27 · loading, then couldn't load" (her); M2 "27 · couldn't load" (brand); M2 "C1 → C3" (empty) | pass |
| 28 | Every confirm sheet honours `busy` | M2 "C5 · 28", "C6 · 28", "C7 …", "C11 · 28" (a double tap = one call) | pass |
| 29 | No new failures against `baseline_item12.json` | `node scripts/compare-tests.js baseline_item12.json final.json` | pass |
| 30 | Her fee alone is split; the campaign fee never on her card, split or release | F "₹12,000 …" (her read has no campaignFee; ledger rows are 3,000s); M1 "the fee card (30)"; M2 "C12" | pass |
| 31 | Still locked from escrow: ₹9,000 → ₹6,000 → ₹0 | F "₹12,000 …" (9,000 → 6,000); J "18 …" (0 once complete); J "a queued tranche still counts … still locked comes from the escrow rows" | pass |
| 32 | The eight legacy routes refuse for every Aim — a loop, one case per Aim | P "a loop over every route, one case per Aim, and not one rupee moves"; P "confirm-live no longer releases tranche 2" | pass |
| 33 | A changed wait doesn't move a stamped due; a new confirmation uses the new number | J "19, 33 …" | pass |
| 34 | A queued tranche blocks the campaign-cancel path, with the reason | P "the campaign-cancel path refuses while a tranche is queued" | pass |
| 35 | Manual release refuses disputed/refunded; audit row with a reason | P "refuses disputed and refunded rows"; P "requires a reason, and a release writes the audit row" | pass |
| 36 | The four adjacent defects are fixed | J "no false low-wallet alert …"; J "a queued tranche still counts as pending …"; J "36 · a notification that fails never loses completion" | pass |
| 37 | Round history to both sides: reasons, verdicts, file ids | F "8, 9, 10, 37 …" (both sides) | pass |
| 38 | Every proof slot before "posted"; a row of two needs two | F "links are checked … every slot before posted" (story × 2) | pass |
| 39 | A brand report freezes every write with one message; hers doesn't | F "17, 39 …"; F "rounds_used is open only …"; F "16, 39, 40 …"; S "a brand report freezes every file write" | pass |
| 40 | A brand_silent report notifies the brand | F "16, 39, 40 …" (the brand's notification, with the sentence) | pass |
| 41 | The sweep deletes an unconfirmed orphan, never a file a round references | S "41 · the sweep deletes an unconfirmed orphan after 24 hours …" | pass |
| 42 | No deliverable rows → the step refuses with Q7's sentence | P "42 · an agreement whose snapshot lists no content …" | pass |
| 43 | Flagged at a shoot stage → shows the current content stage; told once | J "43 · flagged at a SHOOT stage …" | pass |
| 44 | Reminders past the posting date, every 48 h; stop on move, report, completion | J "47 h no · 49 h yes …" (posting date 5 days past; the move changing hands; a report stops it) | pass |
| 45 | A 200 MB MP4 from a real phone, verified by head; a mismatch deleted and refused | Founder's device run 2026-09-25 (194.9 MB, 204,360,095 bytes, twice, production R2; size lock 403 on 14 MB) — lock.json `device_proof`; S "a 200 MB MP4 streams through the signed PUT"; S "storage itself refuses …"; S "what landed differs …"; M4 | pass |
| 46 | A story screenshot obeys the photo rules, served only through G12 | S "only a photo, only on a Story row, only after approval, served only through G12" | pass |
