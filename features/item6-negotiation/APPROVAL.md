# item6-negotiation — approval

The founder's message `INFLX_Item6_Implementation_Prompt.md` (14 Sep 2026) opens with "The item 6 gap
report is approved. Start building." It is kept verbatim as `PROMPT.md`. This file records what it
decided, so a later reader does not have to re-derive it.

## The twelve answers

| # | Question | Answer |
|---|---|---|
| Q1 | A new `pooled` status, or reuse `deferred`? | **Reuse `deferred`** — item 5 already gave it every property the pool needs. Item 5's group label "Asked for another date" becomes **"Moved to your pool"**. A *pending* request keeps its status and shows under **"Your move"**. |
| Q2 | Derive the current turn, or keep it stored? | **Keep `current_turn` stored**, written on every turn, indexed, guarded by a tested `WRONG_TURN`. |
| Q3 | What status for a brand decline? | **`rejected_by_brand`** with the note on the turn; **`declined`** with one of the five reasons for hers. Both re-invitable before the cutoff. |
| Q4 | Is the move request allowed from `negotiating`? | **Yes, from `invited` or `negotiating`, once per invitation**, and add the fifth outcome **`moved`**. Once means once. Agreeing ends an open thread as `moved`; keeping or declining leaves it where it was. The pool carries **the invitation's terms as they stand**, never an unaccepted counter. |
| Q5 | Keep reading `payment_config.allow_commission_negotiation`? | **No** — stop reading it in the counter path; leave the column. |
| Q6 | Does the switch govern the move request? | **No.** A creator who cannot make the date must always be able to say so. |
| Q7 | The earliest date she may ask for? | **Today + 7**, item 4's floor, plus: a wanted date now inside seven days groups as **"· no longer possible"** and pre-fills no posting date. |
| Q8 | A closing-soon warning? | **Yes** — amber "Closing in {n} days" under seven, one notification to both sides at seven days, nothing more. |
| Q9 | Pitch rounds? | **Not in item 6.** Note it in the summary for item 8. |
| Q10 | Reminders instead of the 48-hour decline? | **Yes** — 48 hours and 7 days of silence, notifications only, never a decline; only to the side whose move it is; stopped the moment the move changes hands or the invitation closes. |
| Q11 | Draft the contract on accept? | **Yes**, through the same call item 5's plain accept uses. |
| Q12 | Stamp `min_shoppable_posts` at send? | **Yes.** Every admin number is copied onto the thing it governs when that thing is created. |

## The rules doc
**v1.18** replaces v1.17, with three clarifications in §7B: one move request per invitation; the pool
carries the invitation's terms as they stand; a used pool entry stays used and each admin number is
stamped at creation. **The mockups are unchanged.**

## Four further decisions
1. **One service, two doors.** Counter, accept, decline, move-request and move-answer live in one
   service; the new endpoints and the legacy routes are thin wrappers over it.
2. **A used pool entry is never resurrected.** If she then declines or the invitation expires, the
   entry stays `used`.
3. **Inviting a pool creator into a different date** is allowed for any set of the same Aim; the
   invitation's line then names only the terms, never the date.
4. **She must be told when the date is kept** — a notification behind N12's middle card, carrying the
   card's own sentence.

## Approved as written
The gap report's migration 182 (plus `moved`, `pool` and `min_shoppable_posts`), the turn snapshot,
the accept rewrite, the rounds design, retiring the 48-hour clock, the set-expiry job closing open
threads, the pool as its own table, the move request rebuilt on the three new columns ("the most
important fix in the item"), keyed `platform_settings` with an audit, the admin page, lifting the
draft-only guard on `allow_negotiation`, the Needs You fix, and the frontend plan including deleting
`CounterSoonScreen`.

## Also asked for
- **Nine more checks, 36–44**, added to the 35 in the gap-check prompt. All forty-four are recorded in
  `03-expected-outputs.md`.
- **A final summary** covering migration 182 with its counts, the single service and its doors, the
  fate of the 48-hour job and its notification keys, the move-request defect stated plainly, the pool
  table and its states, the settings and their stamping, the test result against 229 / 940 / 1169,
  every check 1–44, and what is left open for item 7 and item 8.

## Standing constraint
"If anything comes up that none of these cover, stop and ask me. Don't guess." Production-impacting
deploys need an explicit go before migrate / push / OTA.
