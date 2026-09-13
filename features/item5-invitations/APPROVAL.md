The item 5 gap report is approved, with the answers and changes below.

Proceed in order:

1. **Phase 2:** migration 181, the terms validator, the batch send, withdraw and remove, the creator endpoints, the two offer fixes.
2. **Phase 3:** the Brand app screens I1–I10 and the Creator app screens I11–I15.
3. **Phase 4:** unit and API tests only. Nothing is tested end to end until after item 7.

Follow, in this order:

- the rules doc **v1.16** (§7A, amended today after your report);
- the locked mockups (**updated today**: see §2 below);
- the item 5 gap-check prompt;
- your gap report, as changed by this message.

If anything comes up that none of these cover, stop and ask me. Don't guess.

---

## 1. Answers to your 12 questions

**Q1. Yes, add `withdrawn` and `removed`.** Reusing `declined` would put the brand's own actions into the creator's Declined group, which would be a lie. Add both, outside the transaction, and teach all nine lists. Add them to `NON_BLOCKING_STATUSES` too, so a withdrawn creator can be invited again.

**Q2. Yes, one all-or-nothing action.** Your reasoning is right. One thing to add on top of it:

- When the batch fails, the response names every creator that failed and why.
- Review marks those rows and offers one button: **"Remove {n} and send the rest"**. The brand should never have to guess which row to go back to.

**Q3. Yes, the five reasons on the mockup.** Keep the old values readable on legacy rows, cap the note at 200 characters, and put the reason **and** the note into the brand's decline notification, which today carries neither.

**Q4. One shoppable post, as a code constant, shown read-only.** Exactly as the mockup says: "1 post · set by INFLX". The admin setting arrives with the admin-parameters item. Put the constant in one place, named, so that item can replace it in a single edit.

**Q5. Deferred creators — agreed, and a little further.** A creator who asked for another date has **answered**. So:

- She is **not** waiting, and the counts must stop calling her that.
- The set expiry job must **not** close her. Remove `deferred` from its open list.
- She stays visible in the set under her own heading, **"Asked for another date"**, with a "Another set" chip. The mockups now show this (I9). Tapping her row opens her profile; putting her into another set stays where item 4 put it (`GET /campaigns/:id/deferred`).
- **Going forward, item 5's creator screens don't offer this answer at all.** The invitation has Accept, Counter and Decline only, as the mockups show. A date that doesn't suit is a counter (item 6) or a decline ("Dates don't suit"). Leave `/offers/:id/defer` on the server for the existing rows; don't delete it, don't call it.

**Q6. Yes, route the pitch brief through the same terms validator, and keep its eligibility skip.** An agreed pitch has already been negotiated, so the eligibility skip is correct; invalid terms never are. **One caution:** if the brief screen can't supply something the validator requires — deliverables for Pay for Content is the likely one — stop and tell me before you make the brief fail. Don't quietly relax the rule either.

**Q7. Yes, both.** Build the clean endpoints, and strip `brief`, `total_budget`, `set_budget`, `per_influencer_budget` and `coupon_prefix` from the legacy detail and inbox. A creator seeing the brand's budget is a leak whether or not an app calls it today.

**Q8. Commission: more than 0, at most 100, one decimal.** Plus one app-only guard, since a typo here is expensive: **above 50%**, a confirm sheet — "That's more than half of every sale. Are you sure?" — shown once, using the existing ConfirmSheet. Not a server rule; the server accepts anything in range.

**Q9. Yes, exactly as you propose.** Copy the money, the selling scope, the deliverables, the usage rights and a **saved** offer choice. Never a special offer — it was made for one creator. Every creator stays editable afterwards.

**Q10. Agreed.** Withdraw covers `invited` only. Remove covers every pre-signed status, including `applied` and `deferred`.

**Q11. Yes, store all five on the row now** — deliverables, usage rights, selling scope, note and the offer snapshot — in the shapes you propose, so item 7 only has to read them. Put the list in your final summary as the handover note for item 7, and say plainly that a contract today would carry none of them.

**Q12. Ignore the seeded contracts.** "Signed" is always both timestamps. Don't touch that data.

---

## 2. The mockups have been updated

Two changes, both from your report. Everything else is unchanged. Use this version.

1. **I9** now has the **"Asked for another date"** group, between "Accepted, waiting" and "Declined".
2. **I15** now has a fourth creator state, **Closed** (removed): "{Brand} is no longer going ahead with this collaboration." No reason, ever.

The rules table at the foot of the mockups carries the new rows, and the rules doc §7A now matches.

---

## 3. Five more decisions

### 3.1 One backfill after all

Your migration proposes none. Do this much, on the 8 rows:

- `invited_at = created_at` for every existing row. They were all sent.
- `source = 'pitch'` where `agreement_id` is not null, `'legacy'` otherwise.

Without `invited_at` on legacy rows, the "never edit a sent row" guard has nothing to test.

### 3.2 `updateInfluencer` refuses every row, not only sent ones

There is no such thing as an unsent row: the multi-creator draft lives in the app, so a row exists only because it was sent. So the endpoint refuses terms edits on **any** row, with the §7 message, and the silent NULLing of nine fields goes away with it. List any caller that breaks; if a real caller needs a non-terms field, tell me which and we decide then.

### 3.3 The open-group broadcast

It writes invitation rows with no eligibility, no cutoff and no terms validation, and it locks a set. Find out whether any live screen can still trigger it — Brand app, brand website or admin.

- **If nothing can reach it:** leave the code alone and say so in one line.
- **If something can:** switch that action off the way item 4 switched off the website's invite button, and tell me. Don't rebuild it inside item 5.

### 3.4 Counter is hidden, not refused

Show the **Counter** button only when `canCounter` is true. A creator should never tap it and be told no. The placeholder behind it says the negotiation is coming, and writes nothing.

### 3.5 The creators block on the set

Don't build paging for it. If any group is longer than 50 rows, return the first 50 with the group's real count and a "+{n} more" line. Real sets are small; paging can come when they aren't.

---

## 4. Everything else in the report is approved as written

1. **Migration 181** as proposed, plus §3.1's backfill: the two enum values outside the transaction, the eleven columns, the partial unique index on `(set_id, influencer_id)` for live rows, the `(set_id, created_at)` index. Dry-run first and print the counts.
2. **The extracted single-row service** that both the batch send and the legacy brief call, so the fourteen gates live in one place. This is the most valuable thing in your plan; do it properly.
3. **The send design in §7** — set checks once with the set row locked, per-creator checks all collected before any write, one transaction, notifications after commit.
4. **Requiring a posting date** for every send, closing the dateless hole at `campaign.controller.js:1163`.
5. **Withdraw and remove** as designed, including deleting an unsigned contract on remove the way decline already does, and retiring the broken `cancelInfluencer`.
6. **The batch eligibility check** `canBrandInviteMany`, with minimums returned to the brand only, never to a creator.
7. **The group check** with the three labels, and the per-row disabled label in Discover's select mode.
8. **The offer work:** snapshot as it already behaves, the three special-offer kinds, scope hidden for buy-one-get-one, `preview-basket` reused unchanged, and both fixes — **Gap A** (the sale records the offer) and **Gap B** (the start date is respected).
9. **The three notification fixes:** the broken withdraw key, a new removal key, and the decline reason in the body.
10. **The frontend plan** as listed, including recovering `CreatorOfferSheet.js`, `OfferBuilderSheet.js` and `ProductPicker.js`, and the duplicate `brandApi` group methods cleaned up while you're in there.
11. **Expired and withdrawn cards move to Done after seven days.** Closed ones too.

---

## 5. Please also

1. **Add these checks** to the 35 in the prompt:
   - **36.** A creator who asked for another date shows under her own heading, is not counted as waiting, and is still there after the set's cutoff passes.
   - **37.** The creator's invitation offers Accept, Counter and Decline only — no "another date" — and Counter is hidden when negotiation is off.
   - **38.** A failed batch names the creators that failed, writes nothing, and "Remove {n} and send the rest" works.
   - **39.** A legacy row created before today refuses a terms edit, because `invited_at` was backfilled.
   - **40.** The open-group broadcast is either unreachable or switched off, and it is stated which.
   - **41.** A commission above 50% asks for confirmation once in the app and is accepted by the server.
   - **42.** The legacy creator inbox and detail no longer return the brief, the budgets or the coupon prefix, at any status.
2. **Final summary** covering:
   - migration 181 and the backfill, with before and after counts;
   - the single extracted send service, and every door that now goes through it;
   - what the open-group broadcast turned out to be;
   - the two offer fixes, proved with a sale;
   - the item 7 handover: the five terms a contract cannot carry today;
   - test results against your baseline of **229 failed / 914 passed / 1143**;
   - the result of every check, 1–42;
   - anything left open.
