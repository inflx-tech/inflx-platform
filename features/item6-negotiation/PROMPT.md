The item 6 gap report is approved. Start building.

Proceed in order:

1. **Phase 2:** migration 182, the platform-settings service and admin page, the engine changes (snapshot, rounds, outcomes), the six thread endpoints, the move request and answer, the pool with its send hook, the switch, the job changes and the notification keys.
2. **Phase 3:** the Creator screens (N1–N6, N12, N17, N19) and the Brand screens (N7–N11, N13–N16, N18, N20, N21), then the admin page N22.
3. **Phase 4:** unit and API tests only. **Item 7 follows, and the full end-to-end test pack runs after it.**

Follow, in this order:

- the rules doc **v1.18** (§7B, amended today after your report — three clarifications, all in §2 below);
- the locked mockups **N1–N22**;
- the item 6 gap-check prompt;
- your gap report, as changed by this message.

If anything comes up that none of these cover, stop and ask me. Don't guess.

---

## 1. Answers to your 12 questions

**Q1. Reuse `deferred`. Don't add `pooled`.** Item 5 already gave that status every property the pool needs — not waiting, never expired by the job, outside the live unique index, never blocking. Two changes go with it:

- **The label changes.** Item 5's group "Asked for another date" becomes **"Moved to your pool"**, because that is now what the status means: the brand has agreed.
- **A pending request is not that status.** She keeps the status she had, and the row appears under **"Your move"** with "Asked for 27 Oct".

**Q2. Keep `current_turn` stored.** You're right. It's written on every turn, indexed, and guarded by a tested `WRONG_TURN`. Deriving it would delete a working guard to arrive at the same answer.

**Q3. `rejected_by_brand` for a brand decline**, with the note on the turn; `declined` with one of the five reasons for hers. Both re-invitable before the cutoff. Good use of a status that was sitting dead.

**Q4. Yes, allowed from `invited` or `negotiating`, once per invitation, and add the fifth outcome `moved`.** "Moved" is the truth; "expired" would be a small lie in the thread. Three details:

- **Once means once.** If the brand keeps the date, she does not get to ask again with a different one. She accepts or declines what she has. This is now in the doc.
- **Agreeing ends an open thread** as `moved`. Keeping or declining leaves the thread exactly where it was — if the brand still owed a counter reply, it still owes it.
- **The pool carries the invitation's terms as they stand** — never a counter the brand didn't accept. If she countered 13% and the brand never agreed, the entry carries the 12% on the row. N11's confirm says "Her 12% commission — Kept", and it must be telling the truth. This is now in the doc.

**Q5. Yes, stop reading `payment_config.allow_commission_negotiation` in the counter path.** Leave the column. The rules give the brand one control over negotiation — the campaign switch — and a second, platform-wide one that can silently contradict it is a trap.

**Q6. Confirmed: the switch does not govern the move request.** A creator who simply cannot make the date must always be able to say so.

**Q7. Today + 7, with one addition.** That's item 4's floor, so it's the right earliest date to offer. But a date she asks for today can be impossible by the time the brand builds the set. So:

- The pool groups a wanted date that is now less than 7 days away as **"27 Oct · no longer possible"**, and `set-defaults` leaves the posting date empty for it rather than pre-filling an invalid one.
- Item 4's own rule still refuses it at set creation. Nothing new to enforce, only to show.

**Q8. Yes** — amber "Closing in {n} days" under seven, one notification to both sides at seven days, nothing more.

**Q9. Not in item 6.** Leave pitch rounds alone; note it in the summary as something item 8 should look at.

**Q10. Yes: a reminder at 48 hours of silence and one at 7 days, notifications only, never a decline.** Two conditions: a reminder goes only to the side whose move it is, and it stops the moment the move changes hands or the invitation closes. Nobody is nagged about something they can't act on.

**Q11. Yes, keep drafting the contract on accept**, through the same call item 5's plain accept uses. Item 7 must find the same thing whichever road the terms came down.

**Q12. Yes, stamp `min_shoppable_posts` on the invitation at send.** That is the non-retroactive rule applied properly, and it is now in the doc: every admin number is copied onto the thing it governs when that thing is created. Item 5's send writes it, the creator's invitation reads it, item 7 copies it into the agreement.

---

## 2. The rules doc has been updated

**v1.18** replaces v1.17. Three clarifications in §7B, all from your report:

1. One move request per invitation; the brand's answer settles it.
2. The pool carries the invitation's terms as they stand, never an unaccepted counter.
3. A used pool entry stays used, and each admin number is stamped on the thing it governs when that thing is created.

Everything else is unchanged. The mockups are unchanged.

---

## 3. Four more decisions

### 3.1 One service, two doors

Do **not** implement the rules twice. Put counter, accept, decline, move-request and move-answer in **one service**, and make both the new endpoints and the legacy routes thin wrappers over it — exactly the pattern that made item 5's send path work. If a rule can be enforced in one place, it must be.

### 3.2 A used pool entry is never resurrected

She's invited from the pool, the entry is `used`. If she then declines, or the invitation expires, the entry stays `used`. The brand can invite her again the ordinary way. Anything else would leave entries flickering between states and the pool counting people twice.

### 3.3 Inviting a pool creator into a different date

The brand may put a pool creator into any set of the same Aim, not only one matching what she asked for. When the set's date is not the date she asked for, the invitation's line names **only the terms** — "The 12% you agreed on 13 Sep" — and never claims the date. Don't tell her she got what she asked for when she didn't.

### 3.4 She must be told when the date is kept

N12's middle card needs a notification behind it. Add a key for the brand keeping the date, alongside the pool keys. Its message is the card's sentence: "{Brand} are keeping {date}. You can still accept or decline by {date}."

---

## 4. Everything else in the report is approved as written

1. **Migration 182** exactly as proposed, plus: `moved` in the outcome CHECK, `pool` in item 5's `source` CHECK, and `min_shoppable_posts` on `campaign_influencers`. Dry-run first and print the counts.
2. **The turn snapshot** (§7 of your report): `terms_json` in item 5's normalised shape per Aim, the invitation as turn zero, `changes` derived on read and never stored.
3. **Accept** rewriting all four term columns plus `answered_at`, `outcome`, `ended_at`, the notification and the draft contract.
4. **Rounds**: `round_limit` stamped at the first counter, `countersUsed` derived, the (limit + 1)th refused with the exact message, and `isLastRound` in the thread response so both apps can warn before sending.
5. **Retiring the 48-hour clock** exactly as you set out: unschedule, delete the job, stop writing `expires_at`, leave the column and its index. Report the two remaining 48-hour strings you found and whether either needs its copy changed.
6. **The set-expiry job** closing open threads as `expired` with one notification per side, and still leaving `deferred` alone.
7. **The pool as its own table**, for the reasons you gave — it outlives the campaign, is read across campaigns, and carries a lifetime and a state. Your argument against extending the `deferred_*` columns is the right one.
8. **The move request rebuilt on those columns**, with `move_requested_at` / `move_answer` / `move_answered_at`, and the status untouched until the brand agrees. **This is the most important fix in the item**: today she asks and her invitation ends on the spot.
9. **`platform_settings` keyed rows plus `platform_settings_audit`**, cached like `payment_config`, busted on write, one audit row per changed key.
10. **The admin page** modelled on `settings/payments`, read on any admin role, write on `settings` capability, with the audit line at the foot. Update that capability's label to mention platform settings.
11. **Lifting the draft-only guard** on `allow_negotiation`, and surfacing it on the campaign screen and the ⋯ menu.
12. **Needs You**: `counters_to_answer` on each side driven by `current_turn`, `collabStep` reading it instead of assuming the creator owes, and the brand's count filtered to its own move.
13. **The frontend plan** as listed, including deleting `CounterSoonScreen` and adding the "aren't taking counters" line to N19.

---

## 5. Please also

1. **Add these checks** to the 35 in the prompt:
   - **36.** Asking to move does **not** change the invitation's status, and the brand sees it under "Your move". This is the defect being fixed — prove it with the old behaviour named in the test.
   - **37.** The brand keeps the date: she is notified, the invitation is still acceptable, and she cannot ask a second time.
   - **38.** A move agreed while a counter is on the table: the thread ends as `moved`, and the pool entry carries the invitation's terms, not the unaccepted counter.
   - **39.** A pool entry whose wanted date is now inside seven days shows as "no longer possible" and pre-fills no date.
   - **40.** A pool creator invited into a set with a different date sees a line about the terms only, never about the date.
   - **41.** A declined invitation sent from the pool leaves the entry `used`.
   - **42.** `min_shoppable_posts` is stamped at send; changing the admin setting afterwards does not change a live invitation, and does apply to the next one.
   - **43.** Reminders reach only the side whose move it is, and stop when the move changes hands.
   - **44.** The legacy routes and the new endpoints enforce identical rules, because they call the same service.
2. **Final summary** covering:
   - migration 182 with before and after counts;
   - the single negotiation service and every door that goes through it;
   - what happened to the 48-hour job and its notification keys;
   - the move-request fix, stated plainly as a defect fixed;
   - the pool table and how an entry moves through its states;
   - the platform settings, their audit, and how each number is stamped;
   - test results against your baseline of **229 failed / 940 passed / 1169**;
   - the result of every check, 1–44;
   - anything left open for item 7, and the pitch-rounds note for item 8.
