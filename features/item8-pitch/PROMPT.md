The item 8 gap report is approved. Start building.

This is a strong report. It found that the brief path bypasses every check item 2 built, and it was right to lead with that.

Proceed in this order — **the bypass closes first, before any new feature**:

1. **Phase 2a — close the door.** Switch off the brief path, server-side. Nothing else until that is done.
2. **Phase 2b — migration 184:** the thread anchor, the pitch's new columns and indexes, the pool's provenance, the two admin numbers.
3. **Phase 2c — the pitch flow:** send with item 5's validator, the limits, the three answers, the pool entry, the cooldown, the job, the notifications, and §7B's matching rule.
4. **Phase 2d — the retirements**, in your §6 order.
5. **Phase 3 — the screens:** Creator T1–T4, T10, T12–T14; Brand T5–T9, T11.
6. **Phase 4 — tests.** Then the **full end-to-end test pack across items 2–8**, which is the next piece of work after this item.

Follow, in this order:

- the rules doc **v1.21** (§8 and §7B);
- the locked mockups **T1–T14**;
- the item 8 gap-check prompt;
- your gap report, as changed by this message.

If anything comes up that none of these cover, stop and ask me. Don't guess.

---

## 1. Answers to your 12 questions

**Q1. Yes, option A.** Nullable `campaign_influencer_id`, a `pitch_id`, two partial unique indexes, a one-anchor CHECK. The rules require one engine, the table is empty in production so the migration is free, and the split falls along a line the code already has — everything downstream of `loadContext` consumes a flat object and doesn't know where it came from.

**Q2. Not quite as you propose — simpler, and fairer.** Making `response_due_at` the thread's deadline has an unfairness in it: the brand counters on day 28, she has two days, and the whole thing dies through no fault of hers.

So: **the response period governs the brand's first answer only.** That is what it exists for — so she isn't ignored. Once the brand has answered, the clock has done its job. From then the thread runs until the **early close** (her proposed date minus item 4's floor), or until someone ends it.

- No `max()` arithmetic, no extending clocks.
- The early close becomes the real backstop, which is what it should have been.
- The pitch expiry job therefore only ever closes a pitch the brand **never answered**; the early-close lane handles the rest.

**Q3. Agreed — the campaign switch does not apply to a pitch.** A brand that doesn't want pitch negotiation pauses pitches. That control exists and is the right one.

**Q4. Agreed.** `source = 'pool'` on the invitation, because that is the truth about how it was sent; the pitch provenance lives on the pool entry, where T11 reads it. The eight legacy `pitch` rows stay unambiguous.

**Q5. Switch it off, don't delete.** Two conditions:

- **Server-side.** `invite` refuses an `agreement_id` outright with a clear message. A hidden button is not a switch-off.
- The eight existing invitations keep working and the seven readers keep reading.

Deleting is a later cleanup, once nothing has needed it for a while.

**Q6. Leave the nineteen. They are all test data — I have confirmed it.** No conversion, no migration path, no notification, nothing invented. Leave them to their existing ninety-day clock and don't mention them on any screen.

**Q7. Move the two numbers, leave the rest.** One addition: when the pitch's round cap is retired, make sure **nothing still reads `counter_rounds_per_side`**. A dead settings row is harmless; a live one silently contradicting item 6's stamped limit is not. Report what still reads the other ten numbers.

**Q8. Keep the SQL, but the pinning test has to be real.** You're right not to make a paged list N+1. But a test pinning two implementations only catches drift for the fixtures you pick, so:

- the fixtures must cover **every reason code and every setting**, including the past-creator bypass and the paused and blocked cases;
- both sites carry a comment naming the other.

If the thresholds and constants can be lifted into one module both read, do that instead and skip the test.

**Q9. Agreed.** Retire the five `proposal.*` keys and add the `pitch.*` namespace. Five notifications deep-linking to four deleted screens is a live bug, not untidiness.

**Q10. Out of scope, flagged.** One line in the summary: how many pitches are flagged today, and that the queue has no page. Invisible accumulating work is how things get forgotten.

**Q11. Agreed.** Reuse item 4's `earliestGoLiveDay`. Three sevens is already two too many.

**Q12.** Both confirmed, by Q1 and Q5.

---

## 2. Four things you found but didn't ask about

### 2.1 An unmeasured creator is told something untrue

Eligibility coerces a null follower count to 0, so a creator whose numbers haven't been measured fails every brand with a minimum, and the brand list tells her **"You don't match"**. She hasn't been rejected — we don't know her numbers yet.

Add a fourth reason code **for her own screen only**: "Your numbers are still being measured." The brand still sees the same three coarse codes; the privacy rule doesn't change. Report anywhere else the null-to-zero coercion decides something.

### 2.2 The counter asymmetry disappears — say so

Today the brand's counter on a pitch never validates against her requirements while her counter-back does. Through item 6's engine both sides hit the same validator with the same messages. Confirm it in the final summary rather than leaving it to be noticed later.

### 2.3 Delete the two dead specs

`collab-diary.test.js` drives endpoints deleted on 2 September, and the handshake routes spec asserts seventeen routes that no longer exist. Delete both as part of this work and state the baseline **before and after** so the number stays meaningful. A red baseline containing tests for deleted code makes every future baseline worth less.

### 2.4 Fix the global negotiation assertion with the anchor

`item5-invitations.test.js` asserts globally that no negotiation row exists. It breaks the first time a pitch thread is created in the same world. Fix it in Phase 2b with the anchor change, not after it starts failing.

---

## 3. Everything else in the report is approved as written

1. **Migration 184** exactly as proposed — the anchor change, the pitch columns, the partial unique index for one open pitch per Aim, the pool's `from_pitch_id` and `matched_shoot_mode`, and the two `platform_settings` rows. Dry-run first and print every count you listed.
2. **Item 5's validator on the pitch** — `invitationTerms.validateTerms(goal, terms, {mode:'strict'})`, the same function, the same messages. Not a second set of rules.
3. **`proposed_go_live_date` replacing the window**, and `shoot_mode` becoming required, as item 2 anticipated.
4. **The limits**: the partial unique index for one per Aim, one counting query for three per brand.
5. **The cooldown**: keep `proposal_cooldowns`, make the number admin-controlled and stamped, and mirror the date onto the pitch so the list needs one read. Your note about blocking masking a cooldown and it reappearing afterwards is the right behaviour — leave it.
6. **The pool entry on acceptance, and nothing else.** No campaign, no set, no invitation, no contract, no money.
7. **§7B's matching rule** as a flag on the pool entry plus one branch in item 5's send.
8. **The job lane** at `:35`, modelled on item 6's reminders — now only for a pitch the brand never answered, plus the early-close lane.
9. **The retirement plan** in your §6 order, with the rewires you listed for the seven `agreement_id` readers.
10. **The frontend plan** as written. Four genuinely new components is the right answer.
11. **No backfill anywhere.**

---

## 4. Please also

1. **Add these checks** to the 32 in the prompt:
   - **33.** The brief path refuses an `agreement_id` **at the API**, with the message, and the eight existing invitations still read correctly everywhere.
   - **34.** A brand that counters on the last day does not leave her with a two-day deadline: after the first answer the thread runs to the early close, not to `response_due_at`.
   - **35.** A creator whose numbers are unmeasured sees "Your numbers are still being measured" on her own brand list, while the brand still sees only the three coarse codes.
   - **36.** A brand's counter on a pitch is validated against her requirements exactly as her own counter is, with the same messages.
   - **37.** Nothing reads `counter_rounds_per_side` any more, and the pitch's round limit comes only from item 6's stamped value.
   - **38.** The two dead specs are gone, and the baseline is stated before and after.
   - **39.** An open pitch thread appears in the right side's Needs You count, on both sides.
   - **40.** The nineteen ready agreements are untouched, nothing was converted, and no notification was sent about them.
   - **41.** The pinning test proves the brand list's SQL and `canCreatorPitchBrand` agree on every reason code and every setting.
2. **Final summary** covering:
   - the bypass, closed, stated first and plainly;
   - the one engine: what generalising the anchor touched, and what it reused untouched;
   - what was retired, in order, and what replaced each thing;
   - the seven `agreement_id` readers and what each does now;
   - the counter asymmetry, gone;
   - the two admin numbers, and what still reads `handshake_settings`;
   - test results against your baseline of **229 failed / 1024 passed / 1253**, and the new baseline after the two dead specs are removed;
   - the result of every check, 1–41;
   - the flagged-pitch count and the unreachable moderation queue;
   - anything left open before the end-to-end test pack.
