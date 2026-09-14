# item6-negotiation — expected outputs

The 35 checks in `PROMPT.md`'s source (the gap-check prompt §12) plus the nine added in the approval
message (§5.1). Backend evidence is `backend/tests/item6-negotiation.test.js` (42 tests, all passing);
app evidence is `Packages/Mobile/src/screens/influencer/__tests__/item6Creator.test.js` (10) and
`Packages/Mobile/src/screens/brand/__tests__/item6Brand.test.js` (10). "Founder walk" marks a check
whose remaining half is a device walk, which the founder does after item 7 (`PROMPT.md` §3).

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | A creator counters Pay for Sale; the brand sees `10% → 13%` and her note | PASS | backend "a Pay for Sale counter…" · app N2 |
| 2 | A Pay for Content counter carries fee, deliverables and usage rights together, each old → new | PASS | backend "a Pay for Content counter…" · app N3 |
| 3 | A Hybrid counter carries the fixed fee and the commission, and refuses a ₹0 fixed fee | PASS | backend "a Hybrid counter…" |
| 4 | A counter that changes nothing is refused with the exact message | PASS | backend "a counter that changes nothing…" · app N2 (refused before it leaves the phone) |
| 5 | Item 5's limits and messages apply identically to a counter from either side | PASS | backend "item 5's limits and messages…" — the same `invitationTerms.validateTerms` |
| 6 | With rounds at 2, a third counter is refused by the API and the button is gone in the app | PASS | backend "with rounds at 2…" · app "the last round" |
| 7 | The last-counter warning appears on both sides before anything is sent | PASS | same backend test (`isLastRound`) · app creator "the last round" + brand N8 "ROUND 2 OF 2 · YOUR LAST" |
| 8 | Changing the admin rounds setting does not change an open negotiation and does apply to the next | PASS | backend "the limit is stamped at the start…" |
| 9 | The brand accepts: the terms are rewritten, the row moves to accepted, the creator is told | PASS | backend "the brand accepts…" (also asserts the drafted contract) · app N7 |
| 10 | The brand declines with a reason; she sees it; the invitation ends; she can be re-invited before the cutoff | PASS | backend "the brand declines with a reason…" · app N9 |
| 11 | The creator declines mid-negotiation with one of the five reasons, and the brand sees it | PASS | backend "the creator declines mid-negotiation…" · app "the decline sheet…" |
| 12 | No negotiation is auto-declined after 48 hours; the old job no longer runs | PASS | backend "no negotiation is auto-declined…" (asserts the job file is gone and the schedule no longer names it) |
| 13 | At the cutoff an open negotiation ends with its invitation, both see the plain sentence, the thread stays readable | PASS | backend "at the cutoff…" · app N21 |
| 14 | A counter after the cutoff is refused by the API from either side | PASS | backend "a counter after the cutoff…" |
| 15 | With the switch off the creator has no Counter and the API refuses one | PASS | backend "with the switch off…" · app N19 |
| 16 | Turning the switch off does not stop an open negotiation, and turning it back on works | PASS | backend "turning it off does not stop an open negotiation…" |
| 17 | A move request costs no round and is still possible with the switch off | PASS | backend "a move request costs no round…" |
| 18 | "Keep the date" leaves the invitation untouched, and she can still accept it | PASS | backend "'Keep the date' leaves the invitation untouched…" · app N10 "keeping the date is one tap" |
| 19 | Agreeing closes the invitation in a terminal state, keeps the agreed terms, and creates a pool entry | PASS | backend "agreeing closes the invitation…" · app N11 |
| 20 | The set's counts stay honest after a creator moves to the pool | PASS | same backend test (the summary counts are re-read) |
| 21 | The pool is brand-level: an entry made in one campaign is visible when building a set in another | PASS | backend "the pool is brand-level…" |
| 22 | The pool groups creators by what they asked for and shows days left | PASS | same backend test · app N14 |
| 23 | Two different Aims in one set is refused with the exact message | PASS | backend "two Aims in one set is refused…" |
| 24 | Creating a set from the pool pre-fills Aim, mode, branch and posting date; the terms screen pre-fills the money | PASS | backend "set-defaults pre-fills…" |
| 25 | The creator invited from the pool gets a normal invitation, marked, and can accept, counter or decline | PASS | same backend test · app N17 |
| 26 | A creator who became ineligible since joining the pool is caught at send, as in item 5 | PASS | backend "a creator who became ineligible…" |
| 27 | A pool entry expires at the admin lifetime, closes, and the creator is told | PASS | backend "an entry expires at its lifetime…" |
| 28 | Either side can remove a pool entry earlier, and it blocks nothing | PASS | backend "either side may remove an entry early…" |
| 29 | Admin changes a setting: the audit records who, when, old and new; out of range is refused | PASS | backend "the three settings read with their ranges…" · N22 page |
| 30 | The set screen groups creators correctly, with "Your move" first | PASS | backend "the set groups creators with 'Your move' first" · app N20 |
| 31 | Needs You shows exactly one side per open negotiation | PASS | backend "Needs You shows exactly one side…" |
| 32 | Another brand's thread, pool entry or settings → 404; another creator's counter or accept → 404 | PASS | backend "another brand, creator or non-admin is 404 or 403 everywhere" |
| 33 | No creator response carries the brand's note, the minimum warning, the campaign description or another creator's terms | PASS | backend "no creator response carries the brand note…" |
| 34 | Loading, empty and couldn't-load states appear on the thread, the pool and the set screen | PASS (app) / PASS (API) | backend "loading a thread that never started still answers with the invitation as turn zero"; the three screens use item 5's `Loading5` / `EmptyState5` / `ErrorState5`. Founder walk confirms the rendering. |
| 35 | Backend tests show no new failures against the Phase 1 baseline | PASS | see `05-impact.md` — 229 failed / 982 passed / 1211 against the 229 / 940 / 1169 baseline; 42 new tests, 0 new failures |
| 36 | Asking to move does **not** change the invitation's status; the brand sees it under "Your move" | PASS | backend "asking does NOT change the invitation… (check 36 — the defect fixed)"; the test names the old behaviour (status went straight to `deferred`) and asserts it no longer happens |
| 37 | The brand keeps the date: she is notified, the invitation is still acceptable, she cannot ask twice | PASS | backend "'Keep the date' leaves the invitation untouched, tells her, and she cannot ask twice" |
| 38 | A move agreed while a counter is on the table: the thread ends `moved`, the pool carries the invitation's terms | PASS | backend "a move agreed while a counter is on the table…" |
| 39 | A wanted date now inside seven days shows "no longer possible" and pre-fills no date | PASS | backend "a wanted date now inside seven days…" and the seven-day warning half of "an entry expires at its lifetime…" |
| 40 | A pool creator invited into a different date sees a line about the terms only, never the date | PASS | backend "a pool creator invited into a different date…" · app N17 (both halves) |
| 41 | A declined invitation sent from the pool leaves the entry `used` | PASS | backend "a declined invitation sent from the pool leaves the entry used" |
| 42 | `min_shoppable_posts` is stamped at send; changing the setting afterwards does not move a live invitation, and does apply to the next | PASS | backend "min_shoppable_posts is stamped at send…" |
| 43 | Reminders reach only the side whose move it is, and stop when the move changes hands | PASS | backend "reminders go only to the side whose move it is…" |
| 44 | The legacy routes and the new endpoints enforce identical rules, because they call the same service | PASS | backend "the legacy routes and the new endpoints enforce identical rules…" |

## Two further guards, not on the list
- **Nothing moves money, and a signed collaboration is never touched** — backend "nothing here moves
  money, and a signed collaboration is never touched": a signed row refuses counter, accept, decline
  and the move request with "You've both agreed. This can't be changed now."
- **The brand declining the move request** ends the invitation and tells her — backend "the brand
  declines the request…". The same test file also refuses the set's own date, an empty request, and a
  date inside item 4's seven-day floor.
