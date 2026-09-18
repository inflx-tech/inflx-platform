The item 10 gap report is approved. Start building.

This is the best report of the ten. Three findings earned it: **the gate is checked nowhere for money and on two paths of eighteen for signatures**; **every set-first collaboration in production carries the wrong shoot mode**, so the only Store Visit collaboration that exists would open and be told it is Remote; and **`canon` is blind to a new term**, which would have made every time-only counter fail as "nothing changed" on the first day of testing. You also found that the gap-check prompt itself was out of date about the signatures — item 7 added `assertBothSignatures` after that prompt was written. Correct, and say so plainly again in the final summary.

Proceed in this order. **Nothing in Phase 2b starts until 2a is finished and proved:**

1. **Phase 2a — the gate and the mode.** `shootGate` + `assertShootOpen` on every surviving path; `campaign_sets.shoot_mode` becomes the source of the mode; migration 187; the Q2 data correction; the four small defects in §2 below. Prove it with the loop test over the route table before anything else is written.
2. **Phase 2b — the third anchor** in one commit of its own: migration column, `loadShootContext`, `anchorOf`, the `{visitAt}` subject, **`canon`**, `termsLine`, `changesBetween`, `reopen`, `can.decline=false`. Do the engine before the feature that uses it, and test it before the feature that uses it.
3. **Phase 2c — the shoot flow:** plan and send, accept, counter, move, attended, confirm, the two jobs, the reminder lane, the admin number, the notification map, Needs You.
4. **Phase 2d — the retirements**, in your §4.2 order, plus the website panel.
5. **Phase 3 — the screens:** Brand V1–V3, V7, V10–V14; Creator V4–V6, V8, V9, V15.
6. **Phase 4 — tests**, checks 1–30 from the prompt plus 31–48 below, `compare.js` against `baseline_item10.json`, governance check.

Follow, in this order:

- the rules doc **v1.24** (§11.1, §10, §25 — v1.24 is attached and fixes the four contradictions you found; see Q1);
- the locked mockups **V1–V15**;
- the item 10 gap-check prompt;
- your gap report, as changed by this message.

If anything comes up that none of these cover, stop and ask me. Don't guess.

---

## 1. Answers to your 14 questions

**Q1 — The new §11.1 prose wins, and the doc is already fixed.** I have issued **v1.24**, which corrects all four places you found:

- the §11.1 flow diagram now reads "Time negotiation, same engine and same Admin-controlled round limit as section 7B" instead of "Up to two negotiation rounds", and ends "Creator marks that she attended → Brand confirms, or it confirms itself after the Admin-controlled number of days" instead of "Brand marks Shoot Completed";
- §25's *Marking the shoot completed* row now says the Creator marks a Store Visit and the Brand confirms, with the auto-confirm;
- §25's *Content not live by the Posting Date* row no longer moves anything: "The collaboration is flagged Delayed. Nothing else moves";
- §12.1's duplicated pair of confirmation lines is gone.

Build to v1.24. No rule changed — the document now says once what it already meant.

**Q2 — Yes, correct the six rows.** Behind `--fix-modes`, dry-run printed and shown to me before `--apply`, exactly the six ids you listed, `mode = cs.shoot_mode` and nothing else — no timestamps, no status, no money. Print each id with its before and after. They are all Kanchi Silks practice data, so there is no one to tell.

One condition: run the fix **after** the resolver change, not before, so that the fix and the code that prevents a recurrence land together and the regression test covers both.

**Q3 — The move clears her mark, exactly as you propose, with two additions.**

- Clear `influencer_completed_at`, `auto_confirm_due_at` and `auto_confirm_days`; write all three old values into `production_event_log` under `attended_cleared` so the sequence is reconstructible. The auto-confirm clock must stop, or a shoot the brand is disputing confirms itself.
- **Not allowed once the shoot is complete.** After `brand_completed_at` or `auto_confirmed_at`, the visit is done and the collaboration has moved on to content; F6 returns 422 `SHOOT_COMPLETE` "This visit is already confirmed."

She is told "{Brand} asked to move the visit" and the new time is in the thread. No dispute state, no flag, nothing recorded against either side. This is the offline conversation I asked for, with a new time attached to it.

**Q4 — Block.** A Pay for Content or Hybrid collaboration with nothing locked has not satisfied §10, whatever its age. It cannot arise through item 5 and none exists. If one ever appears the brand sees "The money for this collaboration isn't locked yet" and I want to hear about it, not have the shoot quietly open.

**Q5 — One call.** No server draft, no half-plan. The confirm sheet on V3 is the review step; V2 is a form in the phone's memory until she presses send. Same shape as item 5's invitation send.

**Q6 — Refuse at send, and also refuse at set creation.** Your recommendation is right but it catches the problem too late: by the time the plan is sent, the brand has already invited, negotiated, signed and locked money for a visit to a branch nobody can find. That is a dead end with her money in it.

So both:

- **Item 4, set create and update:** when `shoot_mode = 'visit'`, the chosen branch must have a `formatted_address`. Message: "Add the street address to {branch} before you use it for a store visit." This is a small, contained validation on an existing endpoint — do not redesign anything in item 4 around it.
- **F2/F3:** the same refusal as a safety net, for sets created before this rule and for a brand who clears an address afterwards: `BRANCH_NO_ADDRESS`, "Add the street address to {branch} first", with the link to Branches.

`brand_branches` is at brand level and not locked by the set, so a brand blocked by either message can fix it in the app and come straight back. Say so in the message. I will put addresses on the three practice branches before the walk-through.

**Q7 — Yes: the budget is per episode, the limit stays the one stamped at the start.** Counters counted since the last `accept` turn, as you propose. The posting date is what stops this being unbounded, and that is enough — I do not want a cap on reschedules; a brand and a creator who need four goes at a time should have four goes. Two things to make that safe:

- the admin queue shows how many times the thread has reopened, so a pattern is visible;
- the stamped `round_limit` is never re-read from settings on reopen. The number stamped when the thread was born governs every episode of it.

**Q8 — The JS chip picker, restyled, 15-minute steps.** Max = the posting date, min = now. Keep the Stage-4 guard test that fails if a shoot file imports the native picker — it is now enforcing a decision rather than guessing at one. Note that in the new spec so nobody deletes it as leftover.

**Q9 — From 00:00 IST on the agreed day.** Not before. The brand can still move the time after that, per Q3.

**Q10 — No minimum notice.** Only the past is refused. A brand and a creator who agree on "this afternoon" are not doing anything wrong.

**Q11 — Prefill the brand user's login number, editable, validated as an Indian mobile.** Both fields are required; neither is silently inherited if the brand clears them.

**Q12 — Yes, retire the website's visit panel.** Read-only card: "The shoot plan is managed in the app." Retire the `initialise` mode picker and `flip-to-remote` **server-side**, not by hiding the buttons — a hidden button is not a switch-off, same as item 8. The panel's client-side `contract.status === 'active'` test goes with it.

**Q13 — On the collaboration**, `campaign_influencers.delayed_at/_stage`, as you propose. Item 12 sets the same flag for content and I would rather it find the column already there.

**Q14 — Leave the legacy Label Fern row, and make F2 refuse it.** F1 renders it without a countdown and without a cap, read-only. A plan cannot be sent against a collaboration with no posting date, because there is nothing to cap the time against: 422 `NO_POSTING_DATE`, "This is an older collaboration with no posting date. It can't take a shoot plan." One row, one message, no migration.

**Assumptions 1–12:** confirmed as you state them, with your refinements.

---

## 2. Five things you found but didn't ask about

### 2.1 Deliverables invented for unsigned contracts — fix it in 2a

`influencer.controller.js:1615` heals deliverables when `contract.status === 'active'`. Four seeded rows are `active` with no signatures. That is the same defect item 7 settled, in a different file, and it is one line: use `SIGNED_CONTRACT_SQL` / the `influencer_signed_at AND brand_signed_at` test. Do it in 2a with the rest of the gate, and report **every remaining place that treats `contracts.status = 'active'` as signed**, with a verdict on each.

### 2.2 `DangerButton` drops `busy` — fix it in 2a

`primitives.js:144`. Four confirm sheets can be double-tapped mid-request today, and item 10 adds more sheets that move state. One line, and every compare-and-swap you are about to write deserves a button that cannot fire twice in the first place. Check 44 covers it.

### 2.3 `'live'` is not an enum value

Path 18's `ci.status IN (…,'live',…)` silently matches nothing. Fix it with the gate in 2a and say what the correct status list is.

### 2.4 The campaign's negotiation switch does not apply to the shoot time

Item 6 gave the brand a per-campaign switch for commercial negotiation. It has nothing to do with a visit time: a creator who cannot say "that morning doesn't work" would simply not turn up. The shoot thread ignores the switch. Make that explicit in the code, with a comment naming this decision, so nobody wires it in later as consistency.

### 2.5 §25 requires reminders, and shoot threads have none

You noted that pitch threads get no reminders and treated the same gap as pre-existing for shoots. But §25 says the step "stays in Needs You with reminders", and here the money is already locked while everyone waits. So add one lane:

- reuse item 6's `sendReminders` shape, at the free `:55`;
- one nudge to whoever's turn it is when a shoot thread, or an unanswered sent plan, has sat **48 hours**; not more than once per 48 hours; stop at the posting date, where the Delayed flag takes over;
- skip rows whose gate is closed.

Do **not** extend it to pitch threads in this item; record that gap for its own piece of work.

---

## 3. Everything else in the report is approved as written

1. **`shootGate` and `assertShootOpen`** exactly as drafted in §3.5, living beside `SIGNED_CONTRACT_SQL` so there is one definition, called on paths 1, 3, 4, 17 (as a filter), 18, 20 (as a column), F1–F8, both jobs, the reminder lane, and `autoCreateForContract` itself.
2. **Migration 187** as written, including the `num_nonnulls` rewrite of `negotiations_one_anchor` — the XOR form is two-operand, you are right. Dry-run and print every count you listed.
3. **The mode resolver**: `campaign_sets.shoot_mode` first, agreement second, `'remote'` last, so `shoot-plan.test.js`'s 29 stay green. Retire `/initialise`'s mode choice and `flip-to-remote`.
4. **The plan columns**, the branch snapshot into the existing `visit_address*` text columns, `visit_duration_text`, `visit_notes` with the 500 CHECK, and retiring `visit_maps_url` in favour of lat/lng.
5. **Deriving the stage from the timestamps** rather than adding a status vocabulary, the way item 4 derives set states, while still writing `status` for the old readers.
6. **The time rule**: `> now`, `<= endOfIndiaDay(go_live_date)`, on the range endpoint and on every write. Replace `getVisitDateRange`'s `posting_date − 1 day` basis.
7. **The third anchor**, all 17 sites in your §6.2, with `canon` treated as load-bearing and tested on its own.
8. **`reopen`**, shoot anchor only, guarded by `production_event_id IS NOT NULL`.
9. **The endpoints F1–F8** with your error codes and copy, the address and contact revealed to the creator only when `plan_sent_at` is set, `PLAN_LOCKED` on any attempt to edit a sent plan.
10. **Both jobs** as specified, at `:45` and `:05`, `FOR UPDATE SKIP LOCKED`, compare-and-swap updates, counts returned, notifications after commit, the auto-confirm reading only the stamped days.
11. **Needs You**, four moves, from one rule, both sides.
12. **`productionCopy.js`** with the eight keys and the per-item `notify` wrapper, matching items 5–8.
13. **The frontend plan** as written, including the token pass on the orphaned `ShootParts.js` and the eighth `Delayed` tone.
14. **The admin queue extension** and the data-driven settings row.
15. **`features/item10-store-visit/`**, with the four earlier shoot features noted as superseded.
16. **No backfill** anywhere except the six-row mode correction in Q2.
17. **`addParcelItems`' undefined `brandId`** — leave it, item 11's, but write it into the new spec's handover notes so item 11 starts with it.

---

## 4. Please also

### 4.1 Extra final checks — add these to the 30 in the prompt

**The gate**

31. Every surviving path in your §3.2 table refuses a signed-but-unfunded Pay for Content collaboration, proved by a loop over the route table rather than a hand-written test per route.
32. The same loop refuses an unsigned collaboration on every path, and opens a Pay for Sale collaboration on signatures alone with `money.required = false`.
33. `autoCreateForContract` itself refuses to create a row when the gate is closed, so no future caller can create an ungated shoot.
34. The gate card's numbers on V1 equal `contracts.locked_amount` and `released_amount` — the same values item 7's `MoneyMoved7` shows on the same collaboration.

**The mode**

35. A `visit` set produces a `visit` shoot at countersign, and a `shipment` set a `shipment` shoot — the regression for §4.3.
36. `shoot-plan.test.js`'s 29 are still green after the resolver change, and its agreement-fallback assertions still pass.
37. After `--fix-modes`, all six corrected rows match their set, no seventh row changed, and no timestamp or money column moved.

**The engine**

38. A counter that changes only the time is accepted, not rejected as `NOTHING_CHANGED` — the `canon` fix, tested directly on `canon` as well as through the endpoint.
39. Turn zero is the plan and does not consume a round; the limit is the stamped `negotiation_rounds`; `NO_ROUNDS_LEFT` behaves identically on an invitation, a pitch and a shoot.
40. There is no decline route (404) and `can.decline` is false on every shoot thread payload.
41. After a reschedule it is the **same** `negotiations.id`, `outcome` is null, and the round budget is counted from the last `accept` turn.
42. The campaign's negotiation switch, set to off, does not prevent a creator countering a visit time.

**The flow**

43. The brand moving the time after she marked attended clears her mark, the due date and the stamped days, writes `attended_cleared` with the old values to the log, reopens the thread, and notifies her once — and the same call after the shoot is confirmed returns `SHOOT_COMPLETE`.
44. `DangerButton` honours `busy`: two taps on a confirm sheet produce one request, on all four existing sheets and every new one.
45. A visit set cannot be created or updated with a branch that has no street address, and a plan cannot be sent to one; both messages name the branch.
46. A collaboration with no posting date returns `NO_POSTING_DATE` on send and renders read-only on F1 without crashing.
47. An unanswered plan or thread turn is nudged once at 48 hours and not again within 48 hours; nothing is nudged after the posting date; nothing is nudged whose gate is closed.
48. Nothing reads `contracts.status = 'active'` as a signature test anywhere in the codebase, including the deliverable heal.

### 4.2 Final summary — cover, in this order

- **The gate**: what it checks, where it is called, and the before-and-after of the route table — eighteen paths, what each checks now.
- **The mode defect**: the resolver change, the dry-run output, and the six rows before and after.
- **The engine**: what the third anchor touched, what it reused untouched, and `canon` specifically.
- **What was retired**, in order, and what replaced each thing — the slot dance, the flip-to-remote, the website panel, the mode picker.
- **The four small defects** from §2 above, each with its verdict.
- **Every remaining `contracts.status = 'active'` read**, with a verdict on each.
- **Test results** against `baseline_item10.json` — 1330 tests, 1109 passed, 221 failed — with `compare.js` proving no new failures, and the new count after item 10's tests land.
- **The result of every check, 1–48.**
- Anything left open for item 11 or item 12, including `addParcelItems` and the missing pitch-thread reminders.

Nothing is created, sent, confirmed, marked or cancelled in production, and no money moves, without asking me first.
