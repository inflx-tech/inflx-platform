The item 4 gap report is approved. Start building.

Proceed in order:

1. **Phase 2:** database and backend.
2. **Phase 3:** the Brand app screens.
3. **Phase 4:** tests.

Follow, in this order:

- the rules doc v1.14 (§5B and §5);
- the locked mockups (**updated today**: see §2.1 below);
- the item 4 gap-check prompt;
- your gap report, as changed by this message.

If anything comes up that none of these cover, stop and ask me. Don't guess.

---

## 1. Answers to your 9 questions

**Q1: Seven days.** Change the constant on the server and in the app together, plus the test that pins them. The rules doc and the mockups both say seven.

**Q2: Derive the four item 4 states from the sets.** Leave the old `campaign_status` enum alone, and never write `expired` into it.

**Q3: Always calculate the cutoff** from the posting date, and keep writing `invites_close_at` for display and for the expiry job's index. If the two ever disagree, the calculated one wins.

**Q4: "Completed" is your rule:** a set has at least one invitation, is not expired, and every creator row sits in a terminal status. Put it behind one helper so the real completion rule can replace it later, and say in the summary that Pay for Sale sets can't reach it yet.

**Q5: Duplicate copies settings only.** No creators, no invitations, no agreements. While you're in there, also fix the three defects you found: copy `channels_json` and `branch_id`, recompute the campaign rollup, and make the "(copy)" name unique by taking the highest existing letter, not the count.

**Q6: Yes, fix the cross-set bug here.** Exclude the dead statuses, using the list that already exists. Fix the same omission in the open-group broadcast. This unblocks moving a creator who asked for a different date, which was the reason the deferred status exists.

**Q7: 404 on the new endpoints only.** Leave the existing endpoints at 403, so no existing test or caller changes.

**Q8: Yes, fix set delete here.** No set with any invitation can be deleted, so signed contracts can never be destroyed. Where a foreign key would otherwise throw, refuse politely with a readable message instead of a 500.

**Q9: "Invited" counts everyone ever invited,** including those who declined or whose invitation expired.

- The line reads "{invited} invited · {signed} signed · {waiting} waiting", plus "· {n} declined" when anyone declined or expired.
- The bar therefore doesn't always fill: green for signed, blue for waiting, and the rest stays grey. That's the honest picture.

---

## 2. Three more decisions

### 2.1 The mockups have been updated

The attached mockups now show the declined count on C1, C6 and C8. Everything else is unchanged. Use this version.

### 2.2 Turn off the website's "invite to a set"

The creator page on the brand website can send an invitation into any set, with no checks and no warning, and one click would lock a set.

- Replace it with a short message: invitations are sent from the Brand app.
- Don't delete the code; disable the action and the modal.
- Item 5 rebuilds inviting properly on the phone.

### 2.3 Turn off the website's branch editor

It still writes branches into the old place, so a branch added there never appears in the app and can't be used for a Store Visit set.

- Show "Branches are managed in the Brand app" instead, exactly as we did with pitch settings.
- Don't migrate or delete anything.

Both of these are the only website changes in item 4. List them in your final summary as done.

---

## 3. Everything else in the report is approved as written

1. **Migration 180** exactly as proposed: `campaigns.updated_at` and `started_from_group_id`; `campaign_sets.branch_id`, `created_at`, `updated_at` and `expired_at`; the branch CHECK; and the three indexes. Dry-run first and print the counts.
2. **Branch delete must refuse politely** when a set still names that branch, with a readable message, not a database error.
3. **The expiry job** as designed: hourly, India time, one transaction per set with row locking, `expired_at` as the guard that makes it idempotent, one log line per changed set.
4. **The counts query**, grouped, one per list, never per row. `accepted` counts as waiting, as you corrected.
5. **Date rules from the server** on create-campaign, campaign detail and set detail, so the app never guesses the earliest date.
6. **No backfill** for the nine legacy sets. They show as drafts that need a date, which is honest.
7. **The date picker**: reuse the existing pure-JS `DateField` with a token pass and the cutoff line. No new native module, so this ships over the air.
8. **Frontend plan and component reuse** as listed, including deleting item 3's campaign "coming soon" strings rather than leaving them behind.
9. **Locks are the risky change:** enforce them in one place that every caller goes through, and give the exact message from the prompt when something locked is refused.

---

## 4. Please also

1. **Add these checks** to the 20 in the prompt:
   - **21.** A set where creators declined shows "{invited} invited · {signed} signed · {waiting} waiting · {n} declined", and the bar leaves grey space.
   - **22.** A creator who declined in Set A can be invited to Set B of the same campaign. One who is genuinely live in Set A still can't.
   - **23.** Deleting a set that has any invitation is refused with a readable message, and no contract is ever destroyed.
   - **24.** Deleting a branch that a set still names is refused with a readable message.
   - **25.** The website's invite button and branch editor show their new messages, and nothing else on the website changed.
   - **26.** Duplicating a set copies `channels_json` and the branch, recomputes the campaign rollup, and never produces a duplicate name.
2. **Final summary** covering:
   - what changed: migration, services, endpoints, job, screens, the two website switch-offs;
   - the locks change called out plainly, since nothing was locked before;
   - test results against your baseline of 229 failed / 901 passed;
   - the result of every check, 1–26;
   - anything left open, including the "Completed" limitation and the branch with no city.
