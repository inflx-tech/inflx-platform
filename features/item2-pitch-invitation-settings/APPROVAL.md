Approved, with the answers below.

Proceed in order:

1. **Phase 2:** backend and database.
2. **Phase 3:** both phone apps.
3. **Phase 4:** tests.

Follow the rules doc v1.9, the decisions in this message, the locked mockups and the item 2 prompt. If anything comes up that none of these cover, stop and ask me. Don't guess.

Two seed files are attached: `inflx_creator_niches.csv` and `inflx_states_cities.csv`.

---

## Answers to your 17 questions

**Q1: Yes.** A Store Visit set matches only if at least one of the brand's branch cities is in the creator's visit cities.

**Q2: Yes.** "Always allow past creators" skips only the private filters: niches, followers, engagement, languages and cities. It never overrides Paused, Blocked, or the Aims and modes the brand accepts.

**Q3: Yes.** "Previously signed" means a contract with both signatures. An agreed but unsigned handshake does not count.

**Q4: Creator niches are general content niches, not fashion niches.**
- **The list:** seed `ref_creator_niches` from `inflx_creator_niches.csv` (20 rows).
  - It keeps today's codes (`food`, `fashion`, `beauty`, `travel`, `fitness`, `tech`, `home_decor`, `parenting`, `finance`, `education`), so existing creators' choices still match.
  - Admin will add more later.
- **Creator profile (Content preferences):** niche becomes **required**. The creator must choose **exactly one** niche from this list, and the profile won't save without it.
- **Existing creators** whose niche doesn't match a code: show "Not set" and ask them to pick the next time they edit their profile. Do not block their account.
- **The brand's "Creator niches" filter** stays multi-select over this same list.
- The fashion niche names in the mockups (Ethnic wear, Western wear…) were example data only.

**Q4b: Yes.** Keep today's 10 languages.

**Q5: Brand categories.**
- **(a)** Yes, a brand can have more than one.
- **(b)** At brand registration, the brand first picks a **major category**. Fashion is the only option for now, stored in `brands.category` as today. Then it picks **one or more of the 8 sub-categories**: Men, Women, Kids, Plus Size, Watches, Imitation Jewellery, Footwear, Bags & Accessories.
  - This is required and multi-select, stored in the new array column.
  - Put the same control in Business details so existing brands can set theirs.
  - Apply this wherever a brand registers: the app, and the website if it has registration.
- **(c)** Yes. A brand with no sub-categories set does not match a creator who picked categories. Creators who picked no categories are unaffected.

**Q6: State → city list.**
- **(a) Starting list:** seed `ref_states` and `ref_cities` from `inflx_states_cities.csv` (17 states, 63 major cities). We will keep adding states and cities.
  - Add `source` (`seed` | `google`) and `created_at` to `ref_cities` now, so adding cities later needs no migration.
  - **Later, not this item:** when a brand's Google Maps address has a city that isn't in the list, the system adds it automatically with `source = 'google'`.
- **(b)** The branch form and the creator's city switch to the picker in **item 3**. In this item, match typed values by name, as you proposed.
- **(c)** Yes.

**Q7: Yes.** All existing brands and creators start fully open. Ignore the old switch.

**Q8: Yes.** Hide the brand website's old "who can pitch us" panel and show the note that it's managed in the Brand app.

**Q9–Q17: Yes to all your recommendations.**

**One copy change** (from the note at the end of your summary): the 30-day pitch reply rule isn't built yet.
- In **B5**, change the info box to: "Pitches you've already received stay open for you to answer."
- Don't mention 30 days anywhere in this item. The rule and its wording come with item 8.

---

## Please also

1. **List the two small in-scope additions separately** in your final summary: the brand registration sub-categories (Q5b) and the required creator niche (Q4).
2. **Test counts:** report the backend test failure count before and after. There must be **no new failures** compared with the existing ones.
3. **Add three checks** to the 14 in the prompt:
   - **15.** A new brand can't finish registration without at least one sub-category.
   - **16.** A creator can't save their profile without choosing a niche.
   - **17.** A creator who picked Women doesn't match a brand with no sub-categories, until that brand sets Women in Business details.
4. **Finish** with the final summary and the result of every check, 1–17.
