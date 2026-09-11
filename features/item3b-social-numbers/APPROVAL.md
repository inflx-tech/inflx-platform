The item 3b gap report is approved, with the answers and changes below.

Proceed in order:

- **Step 0:** token check and Apify probe.
- **Phase 2:** backend and database.
- **Phase 3:** apps and minimal admin.
- **Phase 4:** tests and live verification.

Follow, in this order:

- the rules doc v1.12 (§2A);
- the locked mockups;
- the item 3b prompt;
- your gap report, as changed by this message.

If anything comes up that none of these cover, stop and ask me. Don't guess.

---

## 0. Before anything: the Apify token and what production really does

1. **A fresh token is in place.** I have regenerated the Apify token, put the new one in Render → `APIFY_TOKEN` myself, and put the same token in local `backend/.env`.
   - **Never print, log, echo or commit the token.** Read it only from the environment.
   - Confirm `backend/.env` and `.env.prod-backup` are git-ignored, and report if either is tracked.
2. **Check the token works** with `GET /v2/users/me`. Report only "valid / invalid" and the plan name, never the token.
3. **Correction to your §0:** production on Render is **not** on mock.
   - Render has `APIFY_MOCK=false` and a real token.
   - Your "mock" finding came from the stale `.env.prod-backup` and the local `.env`.
   - The Apify account shows **US$0.11 already spent**, so real runs have happened.
   - Use the Apify API (`GET /v2/actor-runs`) to list past runs: actor, date, status, cost. Tell me which code started them: registration scrape, the deliverables job, rescrape or n8n. Re-check your §0 facts with this in mind.
4. **`APIFY_INGEST_MODE`** is set on Render (I can't show the value). Find what it controls in code and report it before changing anything that reads it.
5. **Plan and budget:** we stay on Apify's **free plan (US$5 of usage per month)** for now.
   - **Probe (Step 0):** no more than **US$2** in total.
   - **Probe results:** report the real cost per run type, the cost of one full run per creator, and the monthly estimate for 25 and for 1,000 creators on our schedule. I'll decide on upgrading from those numbers.

## 1. Step 0: the probe

- **Run your probe script** with the token from the environment. It must stay within 12 runs and US$2.
- **Test accounts:**
  - **Skip** the private Instagram account and the hides-likes account. Cover those cases with hand-made fixtures only.
  - **Keep** the non-existent Instagram and YouTube handle runs, so "not found" is tested on real output.
- **Report:** fill in §3 of your report with the real answers, and save the trimmed fixtures under `backend/tests/fixtures/apify/`.
- **Carry on to Phase 2 without asking** if the probe confirms the approved design, meaning all of these hold:
  - the fields exist;
  - the two YouTube tab runs work and streams can be excluded;
  - `onlyPostsNewerThan` and `oldestPostDate` work;
  - "not found" can be recognised.
- **Stop and ask** if any finding would change a rule, a number or a screen. Send me the updated §3 with a short list of what differs.

---

## 2. Answers to your 17 questions

**Q1: Token.** See §0. The existing INFLX Apify account is fine; no separate account is needed.

**Q2: Test accounts.** Skip live private and hidden-likes cases (fixtures only). Everything else is probed live.

**Q3: Yes, allow YouTube-only creators.**
- Migration 175 as proposed: `instagram_handle` becomes nullable, keeping the unique index, with the check that at least one handle is set.
- The website claim step stays Instagram-only and is skipped for YouTube-only sign-ups.
- Registration (app and API) requires at least one account.
- Test that a YouTube-only creator can register, be approved by admin, be measured, and appear in Discover with Engagement "—".

**Q4: Yes, hide today's numbers.** Today's numbers came from the spreadsheet import or mock data, not measurements.
- On release, every existing account starts as `measuring`.
- Null that platform's five existing columns at the same moment, so Discover shows "—".
- Write-through happens only after a real run.
- Item 2 minimums will fail for these creators until they are measured. That's expected.

**Q5: Yes.** Spread the backfill over 3 days, with N as an env value.

**Q6: Changed.** Set `APIFY_MONTHLY_BUDGET_USD=5`, to match the free plan.
- **What counts:** the guard counts **all** INFLX Apify runs this month (social numbers, the deliverables job, backfill and probe), using the costs Apify reports.
- **When the budget is reached:** scheduled runs and backfill stop, and admin is flagged once for the month.
- **Still attempted:** approval, handle-confirm and Measure-now runs.
- **Apify refuses a run for credit or usage limits:** classify it as `budget`, not as the creator's technical failure.
  - Don't add to the account's failure count.
  - Don't show `failing`.
  - Retry once the month resets or credit exists.

**Q7: Yes.** Safety ceiling of 500, per platform and per YouTube tab.

**Q8: Yes.** Accept the copy as written in the prompt §5.2.

**Q9: Yes.** The admin CSV import keeps creating creators but stops writing followers and engagement.

**Q10: Yes.** Two tab-restricted YouTube runs per posts run. Report if the probe shows one run labels tabs reliably, but keep two runs.

**Q11: Yes.** Adding a platform after approval needs the admin ownership check.

**Q12: Yes.** Removing a handle needs no admin check while the other platform stays.

**Q13: Yes.** Clear the existing columns to null on change, add, remove, `not_found`, `private` and `rejected` (and on release, per Q4).

**Q14: Yes.** Instagram engagement is "—" when every post hides likes.

**Q15: Yes.**
- Creator detail page: Social numbers panel, **Measure now** (replacing Rescrape), Confirm/Reject.
- `admin/influencers`: a "Handle checks" tab and a Flags list.
- A one-line monthly Apify cost on analytics.
- Keep it minimal; no other website changes.

**Q16: Yes.** Registration becomes two steps: details, then social accounts. The stepper shows 2 steps.

**Q17: Yes.** Unlock Instagram on Profile info, with the admin re-check.

---

## 3. n8n "A2 profile scraper": stop it at registration

- **Remove** the A2 webhook call from registration (`influencer.controller.js:255`). Nothing may be scraped before admin approval.
- **Keep** the n8n workflow and the `creator_profiles` table; delete nothing.
- **Before removing, check** whether admin approval (`creatorVerification.controller.js`) or the claim flow needs a `creator_profiles` row that A2 used to create.
  - If a row is needed, create the minimal row at registration **without scraping**.
  - Approval must keep working for new Instagram-only **and** YouTube-only creators.
- **Report** anything else that calls A2 or reads the rows it wrote, and whether n8n is live in production (from code and config; I will confirm on Render).

---

## 4. Other points from the report

1. **The deliverables job** (`apify-engagement.job.js`) runs real Apify runs daily in production. Include its costs in the budget guard. Report how many runs it has made (from the Apify run list), and whether it runs when there are no live deliverables. If it makes paid runs with nothing to measure, fix that as a small adjacent change.
2. **Apify runner:** the new async runner (`apifyRuns.service.js`) is approved, with polling and no webhook. Leave the two existing sync helpers in place.
3. **Account rows:** a handle change creates a new account row and keeps the old one as `replaced`. Approved.
4. **Tables:** migrations 175–178 and the proposed services, jobs and endpoints are approved as written, with the changes in this message. Dry-run first and show the counts.
5. **Formatting:** add the year suffix and the window label helper to `copy3.js`.

---

## 5. Please also

1. **Add these checks** to the 25 in the prompt:
   - **26.** An Apify credit or usage refusal is recorded as `budget`. It doesn't raise the failure count or show `failing`, and admin is flagged once.
   - **27.** Registration doesn't call n8n A2 or Apify. Admin approval works for a new Instagram-only and a new YouTube-only creator.
   - **28.** A YouTube-only creator registers, is approved, is measured, and shows in Discover with Engagement "—" and on S1 with only a YouTube card.
   - **29.** On release, existing creators show "—" and "Numbers are being updated" until their first real run. Spreadsheet or mock numbers never show as "Measured by INFLX".
   - **30.** The Apify token never appears in logs, errors, API responses, fixtures or commits. Grep the repo and a day of logs.
   - **31.** Probe and test spend stayed within US$2. The run log's total for the month matches the Apify console.
2. **Final summary** covering:
   - the probe findings you relied on;
   - the past-runs explanation (§0.3);
   - what `APIFY_INGEST_MODE` does;
   - real costs and the monthly estimate;
   - test results against the baseline (229 failed / 869 passed / 1098);
   - live verification results with screenshots;
   - the result of every check, 1–31.
