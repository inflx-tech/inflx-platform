# INFLX — Item 4: Campaigns and Sets

## Phase 1: gap identification (backend, database, frontend)

You are working in the INFLX codebase:

- the backend (Node, `backend/src/**`, migrations in `backend/migrations/**`, scheduled jobs in `backend/src/jobs/**`);
- the Brand and Creator phone apps (`Packages/Mobile`);
- the brand website and admin website, which share the same backend.

Three files come with this prompt:

1. **`INFLX_Master_Business_Rules_Phase_1_v1.14.docx`**: the business rules.
   - **Main sections:** **5B (Campaign & Set Creation, new)** and 5.
   - **Related:** 4 (entities), 5A (creator groups), 6 (Aim), 7, 8A, 11.1, 25 (deadlines), 28 (locks), 31.
2. **`INFLX_Item4_Campaigns_Mockups.html`**: the **locked** mockups, screens **C1–C11**.
3. **This prompt.**

**Order of authority:** rules doc → mockups → this prompt. If two disagree, stop and ask. Never guess.

> **This session is Phase 1 only.** Read and report. Do **not** change code, run migrations or edit data. Write the gap report (§10), then **stop and wait for approval**.

---

## 0. How to work

- **The repo is the truth.** Items 2, 3 and 3b were built before this one; earlier reports are guides only. Cite **`file:line`** for every claim.
- **This item touches the oldest, busiest part of the codebase.** Campaigns, sets and invitations already exist and carry live data. Map what is there **before** proposing anything, and say clearly what you would keep, extend, or leave alone.
- **Migrations:** additive only. Find the next free number yourself.
- **Don't break existing callers.** The brand website and admin website may already create or read campaigns and sets. List every caller of every endpoint you propose to change.
- **Server enforcement:** every rule below is enforced on the server, not only in the app.
- **Phone apps** ship over the air. Flag any new native module (a date picker is the likely one) and say whether it is already in the binary.
- **Tests:** record the current backend baseline (passes and failures) before anything. Item 4 must add no new failures.

### Words: rules doc vs code

| Rules doc / mockups | Code (verify) |
|---|---|
| Campaign | `campaigns` |
| Set | `campaign_sets` |
| Aim: Pay for Sale / Pay for Content / Hybrid | `goal = 'conversion'` / `'engagement'` / `'hybrid'` |
| Mode of work: Store Visit / Remote | `shoot_mode = 'visit'` / `'shipment'` (a legacy `'remote'` means "no shoot" and must never be offered) |
| Invitation (a creator in a set) | `campaign_influencers` row, with `status` |
| Agreement signed by both | `contracts.influencer_signed_at` **and** `brand_signed_at` |
| Branch | the branches table item 3 created |
| Creator group | the groups tables item 3 extended |

---

## 1. Aim of this item

### 1.1 In one sentence

Item 4 gives a brand the **Campaigns tab**: it builds a campaign, adds sets that each carry one Aim, one posting date, one mode of work and (for Store Visit) one branch, and then watches each set until its invitation cutoff.

### 1.2 What it delivers

1. **Campaigns tab** with Live, Drafts and Past, replacing item 3's "coming soon" placeholder.
2. **Create and edit** a campaign and its sets, with the rules doc §5B rules enforced on the server.
3. **A date picker** that can only offer valid posting dates, and shows the invitation cutoff as soon as a date is picked.
4. **Locks** the moment the first invitation goes out.
5. **Automatic expiry** of a set that nobody signed by its cutoff, plus the "past sets" view that keeps the history.
6. **Duplicate a set**, and **start a campaign from a creator group** (item 3, G10).

### 1.3 Why it matters

Item 5 (choosing creators, terms, invitations) lives **inside** a set built here. Every later step — agreement, shoot plan, content, money — hangs off the set's Aim, posting date, mode and branch.

### 1.4 Out of scope

- Choosing creators, their terms and sending invitations (item 5). The "Add creators" button is a placeholder.
- Everything after signing: shoot plan, content, money, disputes.
- The delayed-collaboration set for a missed posting date (later item). Item 4 only allows a new set to be created at any time.
- Home, Wallet, the creator app, and brand-website screens.

---

## 2. Screen inventory (locked mockups)

| ID | Screen | Built now? |
|---|---|---|
| C1 | Campaigns tab: Live / Drafts / Past, campaign cards with progress | Yes |
| C2 | Campaigns: empty, loading, couldn't load | Yes |
| C3 | New campaign: name, description, error, "started from a group" banner | Yes |
| C4 | New set: name, Aim, mode, branch, and every field error | Yes |
| C5 | Posting date picker: greyed-out early dates, cutoff line | Yes |
| C6 | Campaign detail: sets list, add another set, show past sets | Yes |
| C7 | Set detail, draft: summary, Add creators, Edit, Duplicate | Yes; "Add creators" is a placeholder |
| C8 | Set detail, live: locked fields, cutoff countdown, progress | Yes; the creator list itself is item 5 |
| C9 | Set states: date passed, expired, completed | Yes |
| C10 | Duplicate a set | Yes |
| C11 | Campaign and set menus, delete confirm | Yes |

---

## 3. How item 4 links to the rest

Report each row as ready / not ready, what is missing, and what item 4 must expose.

| Link | What must be true |
|---|---|
| **Item 3: branches** | A Store Visit set stores one branch. The picker lists the brand's branches, main one first, with city and state names. Report the branch table and endpoint item 3 built, and whether **new brand registration creates the first branch automatically** (rules doc §5B). If it doesn't, fix that here. |
| **Item 3: creator groups** | "New campaign" from a group (G10) passes the group. Item 4 stores it on the campaign and shows it on C3, and the first set's creator picker (item 5) starts from that group's members. |
| **Item 3: Discover** | Item 5's picker reuses the Discover list. Nothing to build here, but don't block it. |
| **Item 2: eligibility** | Invitations are checked against the creator's settings, using the **set's** Aim, mode and branch city. Confirm the eligibility service reads those from the set. |
| **Item 5: invitations** | Item 5 needs, from item 4: the set with Aim, mode, branch, posting date, cutoff, lock flags, and the counts of invited / signed / waiting. Also report the known cross-set bug (a creator already in another set of the same campaign is refused even when that row is declined or expired) and where it lives. |
| **Item 8: pitches** | An agreed pitch ends with the brand adding the creator into a campaign and set. Report how the existing invite-with-agreement path works, so item 4's set data fits it. |
| **Item 9: money** | Funds lock at signing; the INFLX campaign fee applies to Pay for Content. Item 4 shows no money. Confirm nothing in campaign or set creation charges anything today. |
| **Items 10–12: shoot and content** | A Store Visit shoot plan should be able to start from the set's branch address. Report how shoot addresses are stored today and whether the branch can feed them. |
| **Item 19: Home** | Home will list what needs the brand's attention across campaigns and sets. Item 4 must expose counts and states in a way Home can reuse. |
| **Brand and admin websites** | Report every existing campaign or set screen and endpoint there. Item 4 changes **no website screens**, but the server rules will apply to them too. List anything that would break, as an open item. |
| **Existing production data** | How many campaigns and sets exist, in which states, how many have invitations, how many sets have a past posting date, and how many use the legacy `shoot_mode = 'remote'`. |

---

## 4. Data requirements

For each item report status (**E / P / M / C**), evidence and a proposed change.

**D1. Campaign**

| Field | Rule |
|---|---|
| Brand | Owner. |
| Name | Required, ≤ 60 characters. |
| Description | Optional, ≤ 200 characters. **Never shown to creators.** |
| Started-from group | Optional link to a creator group (item 3). |
| Created / updated | Timestamps. |
| State | Draft · Live · Completed · Expired. Say whether you would derive it from the sets or store it, and why. |

**D2. Set**

| Field | Rule |
|---|---|
| Campaign | Parent. |
| Name | Required, ≤ 60 characters. **Shown to creators** in the invitation. |
| Aim | One of the three. Never changes after the first invitation. |
| Mode of work | Store Visit or Remote only. The legacy "no shoot" value is never offered. |
| Branch | Required when the mode is Store Visit; empty otherwise. Must belong to this brand. |
| Posting date | A calendar date, at least 7 days ahead when created. |
| Invitation cutoff | Posting date − 3 days. Say whether you would store it or always calculate it. |
| State | Draft · Live · Completed · Expired. |
| Created / updated | Timestamps. |

**D3. Counts shown on cards (C1, C6, C8).** Per set and per campaign: invited, signed, waiting to answer. One query for a whole list, never per row. Define each from `campaign_influencers` statuses and `contracts` signatures, and list which statuses count as "waiting".

**D4. State rules.**

- **Draft:** no invitation has ever been sent for that set.
- **Live:** at least one invitation sent, and not expired or completed.
- **Completed:** every collaboration in the set has ended. Report whether "ended" is derivable today; if it isn't, say so plainly and propose the nearest workable rule.
- **Expired:** the cutoff passed with no agreement signed by both sides in that set.
- **Campaign:** draft while every set is draft; live if any set is live; completed when all are completed; expired when all have expired. Mixed completed and expired counts as completed.

**D5. Locks.** After the first invitation in a set: Aim, posting date, mode and branch can never change. The set name can. Enforced on the server for every caller.

**D6. Expiry.** A scheduled job closes sets at their cutoff: the set becomes Expired, and every open invitation for it becomes expired so the creator sees it that way. Report the invitation statuses to use, and whether anything similar exists.

**D7. Deletion.** A set can be deleted only while it is a draft with nothing sent. A campaign only while every one of its sets is such a draft. Report what deleting does today (hard delete, soft delete, cascade) and what it should do.

**D8. Duplicate.** Copies name, Aim, mode and branch into a new draft set in the same campaign with a new posting date. Never copies creators, invitations, agreements or anything else. Report the existing duplicate-set code and whether it matches.

**D9. Past date on a draft.** A draft whose posting date has passed cannot invite until a new date is chosen. Report how you would flag it.

**D10. Time and dates.** Posting date is a calendar date. Say what timezone the cutoff uses, when exactly a cutoff passes, and how the app and server agree on "today" and on the earliest allowed date.

**D11. Who may create.** An approved brand. For a Store Visit set, at least one branch with a recognised city. Report the brand's own status flags and the one production brand whose branch has no city.

**D12. Legacy data.** Existing campaigns and sets: missing names, past dates, `shoot_mode = 'remote'`, sets with no Aim, invitations without contracts. Say what the new screens would show for each and whether any backfill is needed.

---

## 5. API requirements

Follow existing naming. Propose request and response shapes and error codes.

| ID | Endpoint | Screens |
|---|---|---|
| A1 | **Campaign list** for the signed-in brand: `state` (live / draft / past), paging, and per campaign: name, state, set count, next posting date, invited / signed / waiting counts. | C1 |
| A2 | **Create campaign**: name, description, optional group id. Returns the campaign as a draft. | C3 |
| A3 | **Update campaign**: name, description. | C11 |
| A4 | **Delete campaign**: allowed only while every set is a draft with nothing sent. | C11 |
| A5 | **Campaign detail**: campaign fields, group it started from, and its sets with meta, dates, state and counts, split into current and past sets. | C6 |
| A6 | **Create set**: name, Aim, mode, branch (Store Visit), posting date. Returns the set with its cutoff. | C4, C5 |
| A7 | **Update set**: rejects any locked field after the first invitation, with a clear code. | C7, C9 |
| A8 | **Delete set**: draft with nothing sent only. | C11 |
| A9 | **Duplicate set**: new name and posting date; copies Aim, mode and branch only. | C10 |
| A10 | **Set detail**: fields, cutoff, lock flags per field, counts, and whether inviting is allowed right now (with the reason when it isn't: date passed, expired, cutoff gone). | C7, C8, C9 |
| A11 | **Branches for the picker** (item 3): id, name, city, state, main flag, main first. | C4 |
| A12 | **Date rules**: the earliest allowed posting date, served by the backend so the app never guesses. | C5 |
| A13 | **Expiry job**: scheduled, idempotent, logged. | D6 |

**Privacy and access:** every endpoint is for the owning brand only; another brand gets 404. Creators never see campaign descriptions, other creators' counts, or draft sets.

---

## 6. Business rules and screen behaviour (exact)

### 6.1 Campaigns tab (C1, C2)

- **Tabs:** Live, Drafts, Past. **Past** holds completed and expired campaigns.
- **Order:** most recently updated first.
- **Campaign card:** name, state chip, "{n} sets · next posting {date}", progress bar, "{invited} invited · {signed} signed · {waiting} waiting".
  - A draft campaign shows "{n} sets · no invitations sent" and no bar.
  - The bar fills to the invited count: green for signed, blue for waiting.
- **Button:** "New campaign" at the top of the list.
- **Empty:** "No campaigns yet" / "A campaign holds your sets. Each set has one Aim, one posting date and one mode of work." / **New campaign**.
- **Loading** skeleton cards; **couldn't load**: "Couldn't load your campaigns" / "Check your connection and try again." / **Try again**.

### 6.2 New campaign (C3)

- **Fields:** name (required, counter to 60) and description (optional, "What is this campaign about?", hint "Only your team sees this. Creators never see it.").
- **Started from a group:** blue box "Started from **{Group}**. Its {n} creators are ready to pick from in your first set."
- **Button:** "Next: add a set" — saves the campaign as a draft and opens the new-set screen.

### 6.3 New set (C4, C5)

- **Header:** the campaign name in small caps above the form.
- **Set name:** required, suggested as "Set A", "Set B" by order in the campaign. Hint: "Creators see this name in their invitation."
- **Aim:** three choices, one only:
  - Pay for Sale — "Commission on what they sell";
  - Pay for Content — "A fixed fee for the content";
  - Hybrid — "A fixed fee plus commission".
  - Hint: "Everyone in this set works to the same Aim. It can't be changed once you invite."
- **Mode of work:** Store Visit or Remote, one only. Hint: "Store Visit: the creator shoots at your branch. Remote: you ship the products."
- **Branch:** shown only for Store Visit. Required. Main branch first. Hint: "Creators see the city, not the address. Your main branch is listed first."
- **Posting date:** opens the calendar (C5).
  - Dates before the earliest allowed day are greyed out and cannot be chosen.
  - Under the calendar: "Dates before {date} are greyed out: a posting date must be at least seven days from today."
  - Once a date is chosen: "Invitations would close {date} 2026." and on the form "Invitations close {date}, three days before posting."
  - The server re-checks the rule and rejects an out-of-range date.
- **Button:** "Save set".

### 6.4 Campaign detail (C6)

- **Header:** campaign name, ⋯ menu, "Created {date}", state chip, description.
- **"Sets {n}"**, newest first. Each card: name, state chip, "{Aim} · {mode} · {branch}", "Posts {date} · invites close {date}", the progress bar and counts, or "No creators yet".
- **Buttons:** "+ Add another set" and "Show past sets ({n})" when there are any.

### 6.5 Set detail (C7, C8)

- **Header:** set name, ⋯, campaign name, state chip.
- **Live sets** show the cutoff strip: "Invitations close in {n} days · {date}". On the last day: "Invitations close today". After it: nothing, because the set has expired or moved on.
- **Summary card rows:** Aim, Mode of work, Branch (Store Visit only), Posting date, Invitations close. Locked rows carry a lock icon.
- **Lock line:**
  - Draft: "Aim, posting date, mode and branch lock when you send the first invitation."
  - Live: "Locked because invitations have gone out. You can still rename the set."
- **Draft:** primary "Add creators"; then "Edit set" and "Duplicate".
- **Live:** "Creators {n}" with the bar and "{invited} invited · {signed} signed · {waiting} waiting to answer"; then "Add creators" and "Duplicate".
- **Empty draft:** "No creators yet" / "Add creators, agree their terms and send invitations."
- **Placeholder:** "Add creators" shows "Coming soon" until item 5.

### 6.6 States (C9)

| State | What shows |
|---|---|
| Draft, date passed | Red chip "Date passed" · warning "Posting date has passed. Pick a new date before you invite anyone." · button "Choose a new date". Inviting is blocked by the server too. |
| Expired | Grey chip "Expired" · "{Aim} · {mode} · posted {date}" · grey box "**Nobody signed by {cutoff date}**" / "The {n} open invitations were closed automatically at the cutoff." · button "Duplicate with a new date". |
| Completed | Purple chip "Completed" · "{Aim} · {mode} · posted {date}" · "{n} collaborations · last one ended {date}". |

### 6.7 Duplicate (C10)

- **Sheet:** "Duplicate {set name}".
- **Fields:** new set name (pre-filled "{name} (copy)") and a posting date, using the same calendar.
- **Card:** "Copied from {set}" with "{Aim} · {mode} · {branch}".
- **Hint:** "Creators and invitations aren't copied. The new set starts as a draft."
- **Buttons:** "Create set" / "Cancel".

### 6.8 Menus and delete (C11)

- **Campaign ⋯:** Rename campaign · Edit description · Delete campaign (red, with "Only while every set is a draft"; hidden or disabled otherwise).
- **Set ⋯ (draft):** Edit set · Duplicate set · Delete set (red).
- **Set ⋯ (live):** Rename set · Duplicate set only.
- **Delete confirm:** "Delete "{name}"?" / "Nothing has been sent for this set, so nothing is lost." / **Keep** / **Delete**.

### 6.9 Expiry (the job)

- At the cutoff, a set with **no agreement signed by both sides** becomes **Expired**; its open invitations become expired; the creators see them as expired.
- A set with at least one signed agreement stays **Live**; unanswered invitations expire on their own.
- Expired sets and campaigns leave the main lists and appear under Past, and are never deleted.
- The job is idempotent, runs at least hourly, and logs what it changed.

---

## 7. Validation and messages (server and app, identical text)

| Field / action | Rule | Message |
|---|---|---|
| Campaign name | Required, ≤ 60 | Enter a campaign name. |
| Campaign description | ≤ 200 | Keep it under 200 characters. |
| Set name | Required, ≤ 60 | Enter a set name. |
| Aim | Required | Pick an Aim. |
| Mode of work | Required | Pick a mode of work. |
| Branch | Required for Store Visit, and must be this brand's | Pick the branch for this Store Visit set. |
| Posting date | Required | Choose a posting date. |
| Posting date (server) | At least 7 days ahead on create | Choose a posting date at least 7 days from today. |
| Locked field | Changed after the first invitation | This can't be changed after you've sent invitations. |
| Delete set | Something was sent | This set has invitations, so it can't be deleted. |
| Delete campaign | Any set has invitations | This campaign has invitations, so it can't be deleted. |
| Invite on a past-date draft | — | Pick a new posting date before you invite anyone. |
| Invite after the cutoff | — | Invitations for this set closed on {date}. |

---

## 8. Look and feel

Item 2's theme, already in the apps:

- White background, `#F6F6F3` surfaces, `#E5E4DE` borders, ink `#1A1A17` / `#5B5A53` / `#77766E`.
- Yellow `#FFC700` for the one main button on a screen.
- State chips: Draft = yourMove orange; Live = active green; Completed = completed purple; Expired = ended grey; "Date passed" = declined red.
- Progress bar: green for signed, blue for waiting, on a surface track.
- Plus Jakarta Sans; dates as "20 Oct 2026" in fields and "20 Oct" in lists.

---

## 9. Phase 1 checklist

### 9.1 Database
- Every field in §4 (D1–D12), with the current `campaigns` and `campaign_sets` columns listed in full, including anything unused.
- `campaign_influencers` statuses in use, and which mean invited, waiting, signed, ended.
- How "collaboration ended" could be derived today.
- Production counts for D12.
- Indexes needed for the lists and counts.

### 9.2 Backend
- Every endpoint in §5, with what exists today (`campaign.controller.js` and friends), its shape, and its callers.
- Where set fields are written today, and whether anything already enforces locks, cutoffs or the 7-day rule.
- The existing duplicate-set and open-group-publish paths.
- The jobs runner, and where an expiry job fits.
- Anything that writes a set's Aim, date, mode or branch after invitations exist.

### 9.3 Phone app
- The current Campaigns placeholder from item 3 and the navigation it sits in.
- Which components from items 2–3 can be reused (rows, chips, sheets, confirm sheets, save bar, skeletons, empty and error states, toasts).
- The date picker: what exists in the app today, whether a new library is needed, and whether it is OTA-safe.
- The screens and files to add per C1–C11.

### 9.4 Websites and admin
- Existing campaign and set screens, and what the new server rules would change for them.

### 9.5 Tests
- Baseline pass and fail counts, and existing tests that touch campaigns, sets and invitations.

---

## 10. Phase 1 output

Write **`Docs/ITEM4_CAMPAIGNS_GAP_REPORT.md`**:

1. **Summary:** area · status · one-line gap.
2. **Requirement table:** ID · requirement · status · evidence (`file:line`) · proposed change · risk.
3. **What already exists, in detail:** campaigns, sets, invitations, duplicate, group publish, and which parts item 4 keeps.
4. **Link readiness (§3).**
5. **Proposed migrations** (additive), with dry-run checks and any backfill for legacy sets.
6. **Proposed endpoints** with shapes, error codes and affected callers.
7. **Expiry job design** and how it is proved idempotent.
8. **Counts and list queries,** with the SQL shape and indexes.
9. **Frontend plan** per screen, components reused, and the date-picker decision.
10. **Test baseline** and the tests you will add.
11. **Questions for the founder,** each with a recommendation, including every assumption in §11.

Then **stop and wait for approval.**

## 11. Assumptions to confirm in your questions

1. **Timezone:** dates and cutoffs are handled in India time, and a cutoff passes at the end of that day.
2. **"Completed"** is whatever the collaboration data can honestly support today; the exact rule follows the lifecycle work.
3. **Legacy sets** with `shoot_mode = 'remote'`, no Aim or a past date are shown as they are and are never auto-changed.
4. **Set names** are suggested as "Set A", "Set B" and can be anything the brand types.
5. **Past tab** holds completed and expired campaigns together.
6. **Live sets** can still be renamed, and their ⋯ menu offers only Rename and Duplicate.
7. **Campaign delete** is blocked by any set that has ever sent an invitation, even an expired one.
8. **A campaign started from a group** keeps that link for item 5's picker, and the link is not shown to creators.

---

## 12. After approval (not in Phase 1)

- **Phase 2:** migrations, state rules, locks, endpoints A1–A13, the expiry job, and the count queries.
- **Phase 3:** the Brand app screens C1–C11, including the date picker, menus and confirm sheets, with every message from §7.
- **Phase 4:** tests and final functionality.

### 12.1 Final functionality: all must pass on a phone

1. A brand with no campaigns sees the empty state and can create one from it.
2. A campaign saves with a name only; a 201-character description is refused with the exact message.
3. A new set saves with name, Aim, mode and date. For Store Visit the branch is required; for Remote no branch is asked for or stored.
4. The date picker greys out every date before the seven-day mark, and the cutoff shown matches posting date − 3 days.
5. A posting date sent directly to the API, earlier than allowed, is refused.
6. A draft set can be edited and deleted; the campaign can be deleted while all its sets are drafts.
7. After the first invitation: Aim, posting date, mode and branch are refused by the API and shown locked in the app; renaming still works.
8. A set with invitations can't be deleted, and neither can its campaign.
9. Counts are right on the campaign card, the set card and the set detail: invited, signed and waiting match the data.
10. At the cutoff with nobody signed, the job expires the set, closes its open invitations, and the creators see them as expired.
11. At the cutoff with one creator signed, the set stays live and only the unanswered invitations expire.
12. Expired and completed items leave Live and appear under Past and "Show past sets".
13. A draft whose posting date has passed shows the warning, and inviting is refused by the API.
14. Duplicating a set copies Aim, mode and branch, and copies no creators, invitations or agreements.
15. A campaign started from a creator group shows the group on the campaign, and item 5's picker can read those members.
16. Another brand's campaign, set or duplicate request returns 404.
17. Creators never receive campaign descriptions or draft sets in any response.
18. Loading, empty and couldn't-load states appear on the list and detail screens, and Try again works.
19. The brand website and admin still work against the new rules, or the breakages are listed.
20. Backend tests show no new failures against the Phase 1 baseline.

### 12.2 Final deliverable

A short summary of what changed, the test results, how to try checks 1–20 on a phone, and anything left open.
