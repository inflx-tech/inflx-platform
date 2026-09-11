The item 3 gap report is approved, with the answers and changes below.

Proceed in order:

1. **Phase 2:** backend and database.
2. **Phase 3:** both phone apps.
3. **Phase 4:** tests.

Follow, in this order:

- the rules doc v1.11;
- the locked mockups;
- the item 3 prompt;
- your gap report, as changed by this message.

If anything comes up that none of these cover, stop and ask me. Don't guess.

One seed file is attached: `inflx_states_cities_additions.csv`.

Your vocabulary correction is accepted: the 8 sub-categories live in `brands.sub_categories`.

---

## 0. Scope: phone apps only

We are concentrating on the **Brand and Creator phone apps** now. Brand website decisions come later, in a separate discussion.

- **No website screen or copy changes** in item 3. Don't hide the website's branch editor. Don't rename "Shortlist". Don't touch its creator search or detail pages.
- **Don't break website callers.** Every changed endpoint keeps its current response as a superset: `/influencers/search`, `/influencers/:id`, the six group routes and `/brands/me`.
- **Server rules still apply to every caller.** Group name rules, the 100 cap and approved-only creators will also apply when the website creates or edits groups. That is expected.
- **List the website side effects separately** in your final summary, as open items for the website discussion. At minimum:
  1. Website creator search stops showing pending creators.
  2. The website branch editor no longer changes branches once they move to `brand_branches`.
  3. Group rules are now enforced for "Shortlist".
  4. Anything else you find.

---

## 1. Answers to your 19 questions

**Q1: Yes.** "Most followers" = the higher of Instagram followers and YouTube subscribers.

**Q2: Yes.** The Aims and Mode filters match creators who accept at least one selected value.

**Q3: Yes.** Discover and group statuses are brand-level only. Set-level rules come in item 5.

**Q4: Yes.** Creators the brand has blocked appear normally in Discover and groups, with a small grey **"Blocked by you"** chip. Nothing else changes.

**Q5: Changed.** Don't show a "completed" count yet.

- **P1 shows:** "{N} collaborations signed on INFLX".
  - N = contracts signed by **both** sides, across all brands.
  - Hide the line when N is 0.
- **Later:** switch the wording back to "completed" when the completion rules are built (item 1 follow-up). Put the count behind one helper so that switch is a one-line change.
- **P2 "Collaborations with you"** lists only this brand's collaborations with a contract signed by both, the same rule as Worked with.
  - Invitations and negotiations before signing are not listed.
  - Map the state chip with your shared `collabState.familyOf(status)` helper.

**Q6: Yes.**

- A product is out of stock when its stock is 0, or when it has sizes and every size's stock is 0.
- A size is unavailable when its stock is 0.
- Blank stock means available.

**Q7: Yes.** Read sizes and images from `variants_json`.

**Q8: Yes.** Match existing typed cities by name. List the unmatched ones in your summary. Never auto-add them.

- The attached CSV adds **Delhi** (Delhi), **Ongole** (Andhra Pradesh) and **Karnal** (Haryana), so every existing brand and creator city matches.
- Backfill again after seeding.

**Q9: Changed.** States are **not** auto-added.

- Seed **all 36 states and union territories** now, from `inflx_states_cities_additions.csv`. It has 19 new states/UTs with their main cities, plus the three cities above.
  - Rows use `source = 'seed'`.
  - Continue `state_sort` from 18.
- Only **cities** are added automatically from Google.
- Keep the state alias table for Google spellings, for example "NCT of Delhi" → Delhi and "Pondicherry" → Puducherry.
- If Google still returns a state that doesn't resolve, return `STATE_UNKNOWN` and add nothing. The app shows under the address field:
  - "We couldn't match this address to a state. Try a nearby address."
- Log the raw state name for admin.

**Q10: Yes.** A branch with planned shoots can be removed, using the confirm text in the prompt.

**Q11: Changed.**

- **Suspended creator:**
  - **Hidden, not removed.** Keep their member rows.
  - Hide them from group detail, member counts, "open to invitations" counts and avatar stacks.
  - They can't be added while suspended.
  - If admin approves them again, they reappear in the same groups.
- **Rejected creator:** delete their member rows.
- **Account deletion:** cascade when it exists later.
- **Every group read** filters to `users.status = 'approved'`.

**Q12: Yes.** Groups belong to the brand, not to a login.

**Q13: Not now.** Website discussion later (see §0). Don't change the website branch editor in item 3.

**Q14: Yes.** Add `u.status = 'approved'` to `/influencers/search`, and gate `/influencers/:id` for brand callers. This is a rules and privacy requirement. Report it as a website side effect.

**Q15: Not now.** Keep the website's groups working against the extended endpoints. No rename in item 3.

**Q16: Yes.**

- The app refuses files over 5 MB before uploading.
- The server checks the stored object's size and type when the key is saved, and rejects it with "Upload a JPG or PNG under 5 MB."

**Q17: Yes.** Engagement means Instagram engagement.

**Q18: Yes, as a separate item.**

- The refresh job is **not** part of item 3. It becomes a small item **3b**, built before the end-to-end test after item 7.
- In item 3, show "—" for unmeasured numbers and "updated {d Mon}" from `measured_at`.
- Hide the "updated" line when there is no date.

**Q19: Yes.** Item 5 fixes the cross-set invite check. Item 3 only records it.

---

## 2. Other decisions from reading the report

1. **Privacy leaks: fix all of them in item 3.**
   - **Leak 1:** remove `address_line` from `/brands/:id/public`.
   - **Leak 2:** the public shopper brand store (`follower.service.js:745`) must whitelist the `listing_data` keys it needs. It must **never** return `branches`, phone numbers or addresses. This is outside item 3's screens but must be fixed now.
   - **Leak 3:** make search and detail approved-only, and stop hard-coding `is_inflx_verified TRUE`.
   - **Leak 4:** rewrite the find-brands facets, and drop the retired `accepts_proposals` read.
2. **Test helper, first.** Before any item 3 change, fix the backend test factory so it registers **fashion** brands with at least one sub-category.
   - Do this as its own commit.
   - Run the full suite and record the new baseline.
   - Report three numbers: 474 before the fix, the count after the fix, and the count at the end of item 3.
   - The end count must have **no new failures** compared with the after-fix baseline.
3. **Migrations 170–173 are approved as proposed**, with these changes:
   - Seed the CSV additions in their own migration (for example `174_item3_states_cities_seed.sql`), run **before** the city and branch backfills.
   - The groups name constraint may stay `NOT VALID` only until the dry run confirms the 7 existing groups pass. Validate it in the same run.
   - Dry-run first with the existing runner pattern and show the counts before applying.
4. **Brand with no main branch city** (1 brand today):
   - The A1 Branches row shows the orange reminder: "Add your main branch address so creators can see your city."
   - The brand overview shows only "Fashion" with no city until the address is added.
5. **Phone on A2:** show the **login phone**, masked. Fix the `brands.phone` shadowing as proposed.
6. **"Newest" sort** in Discover and Find brands = `approved_at` when set, otherwise `users.created_at`.
7. **Endpoints are approved as proposed:**
   - `discover-creators`, `worked-with`, `find-brands`;
   - the extended group routes (backward-compatible);
   - `places/resolve` with the 10-minute cache and a limit of 60 per minute per user;
   - the brand logo upload;
   - branches CRUD with `make-main`;
   - brand products list and detail;
   - `reference/cities?ids=`;
   - the extensions to `/brands/me`, `/influencers/me`, `/influencers/:id` and `/brands/:id/public`.
8. **Bulk status helpers** `statusForCreators` and `statusForBrands` are approved. Discover, groups and Find brands must use them: one query per page, never per creator.
9. **Phone app files:** your file plan is approved.
   - Delete `FindPartyScreen.js` and the old inline profile forms.
   - "Payment & tax" becomes its own screen behind the My Profile row, with the same content.
   - Remove the decorative notifications switch.
10. **Coming-soon toasts** for Invite to a set, New campaign, and Pitch this brand: use the prompt's copy.
11. **GIN index on `creator_posts.scoped_brand_ids`:** yes. Include it now for item 13.

---

## 3. Please also

1. **Add these checks** to the 25 in the prompt:
   - **26.** The public shopper brand store response contains no `branches`, phone numbers or addresses.
   - **27.** A suspended creator disappears from a group and its counts. After admin approves them again, they are back in the same group. A rejected creator's member rows are deleted.
   - **28.** The test factory is fixed. Report all three baseline numbers, with no new failures against the after-fix baseline.
   - **29.** The state picker lists all 36 states and union territories. A Delhi address resolves to Delhi state and a Delhi city without adding a state. An unresolvable state returns `STATE_UNKNOWN` and adds nothing.
   - **30.** P1 shows "{N} collaborations signed on INFLX" and hides it at 0. P2 lists only collaborations signed by both.
   - **31.** A creator the brand has blocked shows "Blocked by you" in Discover, in groups and on their profile.
2. **Final summary** covering:
   - what changed: migrations, endpoints, services and screens;
   - the unmatched city list after seeding;
   - test results against the baselines;
   - the website side effects (§0) listed separately;
   - how to try checks 1–31 on a phone, with the result of every check.
