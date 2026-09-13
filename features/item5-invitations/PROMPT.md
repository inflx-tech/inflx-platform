# INFLX — Item 5: Choosing creators, terms and invitations

## Phase 1: gap identification (backend, database, frontend)

You are working in the INFLX codebase:

- the backend (Node, `backend/src/**`, migrations in `backend/migrations/**`, scheduled jobs in `backend/src/jobs/**`);
- the Brand and Creator phone apps (`Packages/Mobile`);
- the brand website and admin website, which share the same backend.

Three files come with this prompt:

1. **`INFLX_Master_Business_Rules_Phase_1_v1.15.docx`**: the business rules.
   - **Main section:** **7A (Sending Invitations — Creators, Terms and Offers, new)**.
   - **Related:** 4 (entities), 5 (campaigns and sets), 5A (creator groups), 5B (campaign and set creation), 6 (Aim), 7 (offers and terms), 8A (pitch and invitation settings), 9 (agreement), 11.1 / 11.2 (shoot), 12.1 / 12.2 (delivery), 15 / 15.1 (selling scope and offers), 21 (money), 25 (deadlines), 28 (locks), 31.
2. **`INFLX_Item5_Invitations_Mockups.html`**: the **locked** mockups, screens **I1–I15**, plus the rules table at the end of that page.
3. **This prompt.**

**Order of authority:** rules doc → mockups → this prompt. If two disagree, stop and ask. Never guess.

> **This session is Phase 1 only.** Read and report. Do **not** change code, run migrations, or edit data. Do **not** create, invite, approve or send anything in **production**. Write the gap report (§10), then **stop and wait for approval.**

---

## 0. How to work

- **The repo is the truth.** Items 2, 3, 3b and 4 were built before this one; earlier reports are guides only. Cite **`file:line`** for every claim.
- **This item sits on top of the oldest code in the product.** `campaign_influencers`, `brand_offers`, `contracts` and the eligibility service already exist and carry live data. Map what is there **before** proposing anything, and say clearly what you keep, extend, or leave alone.
- **Item 4 has just been built.** Read its code as it is now, not as the item 4 report described it. Report anything item 4 left open that item 5 depends on.
- **Migrations:** additive only. Find the next free number yourself. Dry-run first and print counts.
- **Don't break existing callers.** The brand website, the admin website, the pitch flow (item 8) and the n8n/automation paths may already create `campaign_influencers` rows. List every caller of every endpoint or service you propose to change.
- **Server enforcement:** every rule below is enforced on the server, not only in the app. Assume a creator or a brand will call the API directly.
- **Phone apps** ship over the air. Flag any new native module and say whether it is already in the binary.
- **Tests:** record the current backend baseline (passes and failures) before anything. Item 5 must add no new failures.
- **Money is never moved in item 5.** Nothing here charges, locks or releases funds.

### Words: rules doc vs code

| Rules doc / mockups | Code (verify) |
|---|---|
| Creator | `influencer` |
| Campaign | `campaigns` |
| Set | `campaign_sets` |
| Invitation (one creator in one set) | a `campaign_influencers` row, with `status` |
| Terms | the money and delivery columns on that row |
| Aim: Pay for Sale / Pay for Content / Hybrid | `goal = 'conversion'` / `'engagement'` / `'hybrid'` |
| Mode of work: Store Visit / Remote | `shoot_mode = 'visit'` / `'shipment'` (legacy `'remote'` = "no shoot", never offered) |
| Follower offer | `brand_offers` library row, or inline `offer_type` + `offer_config_json` on the invitation |
| Agreement signed by both | `contracts.influencer_signed_at` **and** `brand_signed_at` |
| Creator group | `influencer_groups` + `influencer_group_members` |
| Branch | `brand_branches` |
| Counter / negotiation | item 6, not built here |

---

## 1. Aim of this item

### 1.1 In one sentence

Item 5 lets a brand **choose creators into a set, agree what each one individually gets, and send each of them one invitation**, and lets the creator **read that invitation and accept, counter or decline** before the set's cutoff.

### 1.2 What it delivers

1. **A creator picker inside a set** (Brand app) that reuses item 3's Discover list, Worked with and Groups, and only offers creators who pass the item 2 checks **for this set**.
2. **A terms screen per creator**, whose fields depend on the set's Aim, with the set's own terms shown locked at the top, and the creator's minimums shown as a warning that never blocks.
3. **A follower offer per creator**: none, a saved offer copied from the brand's library, or a special offer created for that creator alone.
4. **Review and send**, which sends one invitation per creator and makes the set live (locking the set's Aim, posting date, mode and branch — item 4).
5. **The set after sending**: creators grouped by what is happening, with withdraw and remove.
6. **The creator's Invites tab and invitation screen**, with accept, counter (hand-off to item 6) and decline with a reason.
7. **Two small server fixes** that this item depends on: record **which offer produced each sale**, and **respect an offer's start date**.

### 1.3 Why it matters

Everything after this — negotiation (6), the agreement (7), funding (9), the shoot (10, 11), content and payment (12, 13) — reads the terms written here. If a field is missing here, it is missing from every later step, and it cannot be added after signing.

### 1.4 Out of scope

- **Countering** itself (item 6). The **Counter** button must exist and route to a clear placeholder; report exactly what exists today for counter-offers so item 6 can build on it.
- **The agreement** (item 7). "Send agreement" and "Waiting for the agreement" are labels only.
- Funding, wallet, shoot plan, content, sales, disputes.
- **Creator pitches** (item 8), except where they write the same rows — report, don't change.
- **Bundle and free-gift offers**, branch-level offers, offer stacking and usage limits — all stay as they are.
- Home, Wallet, and brand-website screens beyond what §3 asks you to report.

---

## 2. Screen inventory (locked mockups)

| ID | Screen | App |
|---|---|---|
| I1 | Add creators to a set: All creators / Worked with / Groups, search, filters, select checkboxes, ineligible and already-invited rows | Brand |
| I2 | Invite a whole group: "9 of 12 can be invited", the can't-be-invited list with short reasons | Brand |
| I3 | Terms · Pay for Sale: locked set terms, commission, selling scope, follower offer, shoppable posts read-only, "use for everyone" | Brand |
| I4 | Terms · Pay for Content: fee, deliverable rows, note, usage rights with duration and places | Brand |
| I5 | Terms · Hybrid: fixed fee + commission + selling scope + offer | Brand |
| I6 | Follower offer sheet: none / saved offer / special offer, saved list, shopper-and-creator preview | Brand |
| I7 | Special offer sheet: money off, buy more save more, buy one get one; applies-to; dates; "also save to my offers"; preview | Brand |
| I8 | Review and send: locked set summary, below-minimum warning, one row per creator, "Send N invitations" | Brand |
| I9 | The set after sending: cutoff countdown, progress bar, counts, creators grouped by state, Add creators | Brand |
| I10 | One creator ⋯: view terms sent, open profile, withdraw, remove; withdraw confirm | Brand |
| I11 | Creator · Invites tab: invitation cards with Aim, mode, date, money and deadline | Creator |
| I12 | Creator · a Pay for Sale invitation: set terms block, personal terms block, note, Accept / Counter / Decline | Creator |
| I13 | Creator · a Pay for Content invitation: deliverables and the 25/25/50 split | Creator |
| I14 | Accept confirm; decline with a reason chip and optional text | Creator |
| I15 | Creator · accepted-waiting, expired, withdrawn, empty | Creator |

The mockups page ends with a **rules table**. Treat every row of it as a requirement.

---

## 3. How item 5 links to the rest

Report each row as **ready / not ready**, what is missing, and what item 5 must expose or consume.

| Link | What must be true |
|---|---|
| **Item 2: eligibility** | The picker and the send call both run the eligibility service with **this set's** Aim, mode and branch city. Report the service, its reason codes (OK / NOT_ACCEPTING / NOT_MATCHING) and warning codes (BELOW_MIN_FEE / BELOW_MIN_COMMISSION), whether it can be run for a **list** of creators in one call, and whether blocked-brand creators are indistinguishable from paused ones. |
| **Item 2: minimums** | Per-category minimum fee and minimum commission must be readable for the terms screen's warning. Report where they live and how a category is matched to the set. |
| **Item 3: Discover** | The picker is the Discover list in select mode: same search, filters, sort, paging and card content, plus a checkbox. Report the endpoint and the app components, and what "select mode" needs. |
| **Item 3: Worked with** | Second tab of the picker. Report how "worked with" is derived today. |
| **Item 3: groups** | Third tab plus I2. Report the group tables, the member endpoint, and G9's per-member check as item 3 built it. |
| **Item 3b: social numbers** | Cards in the picker show followers and engagement, with "—" where not measured. Nothing new to build; confirm the picker's rows can carry them. |
| **Item 4: the set** | Item 5 reads Aim, posting date, mode, branch, cutoff, lock flags and counts, and **sending is what makes the set live and locks it**. Report exactly where that lock is set today and whether it is set by the send path. |
| **Item 4: cutoff** | Nothing may be sent after posting date − 3 days, India time, end of day. Report the helper (`backend/src/utils/indiaDay.js`) and every place that computes the cutoff. |
| **Item 4: cross-set rule** | A creator may be in more than one set of a campaign, and a dead row (declined, expired, withdrawn, removed) must never block a new invitation. Item 4 fixed this; confirm it in the code as it now stands and report the exact status list used. |
| **Item 4: expiry job** | At the cutoff the job expires open invitations. Item 5's statuses must match what that job writes. Report the job and the statuses it touches. |
| **Item 6: negotiation** | Counter must land somewhere. Report what exists today: counter-offer columns, tables, endpoints, notifications, and whether a counter is a new row or an edit. Propose the smallest hand-off point, and build **no** negotiation logic. |
| **Item 7: agreement** | After accept, the brand sends an agreement. Report the `contracts` table, what creates a contract today, which terms it copies, and whether every field item 5 writes can reach it. Anything item 5 collects that the contract can't carry is a gap to name. |
| **Item 8: pitches** | An agreed pitch also ends in a `campaign_influencers` row with terms. Report that path in full and whether it would satisfy or bypass item 5's rules. Don't change it; list the divergences. |
| **Item 9 / 21: money** | The fee split is 25% on signing, 25% when content is live, 50% after it stays live; commission is on what shoppers actually pay. Item 5 only records the numbers. Confirm nothing in the send path charges or locks funds. |
| **Items 15 / 15.1: offers and selling scope** | The selling scope (whole store / categories / chosen products) and the follower offer decide what the shopper sees and what commission is paid on. Report the offer engine in full (`brand_offers`, the five types, `brand_offer_id` vs inline `offer_type` + `offer_config_json`, scope handling, `POST /campaigns/preview-basket`), and the two known gaps: **the sale doesn't record which offer produced it**, and **an offer's start date isn't respected**. |
| **Items 13 / 20: shoppable posts** | "At least 1 shoppable post" is shown read-only on Pay for Sale and Hybrid terms. Report where that minimum comes from (admin setting or constant) and whether it is per set, per brand or global. |
| **Item 19: Home** | Home will show "needs you" counts across sets. Item 5 must expose per-set and per-brand counts in a reusable shape. |
| **Notifications** | The creator must learn about a new invitation, a withdrawal and a removal; the brand about an accept and a decline. Report the notification system, the existing templates for invitations, and what is missing. |
| **Brand and admin websites** | Report every website or admin screen that creates, edits or cancels an invitation, or edits an offer. Item 4 already switched off the website's "invite to a set"; confirm that is in place. Item 5 changes no website screens unless you find one that can break a rule — list those as open items. |
| **Existing production data** | Counts: `campaign_influencers` rows by status; rows with terms but no contract; rows whose set is expired; `brand_offers` rows by type and how many are attached to an invitation; invitations using inline bespoke offers; rows created by the pitch path. |

---

## 4. Data requirements

For each item report status (**E** exists / **P** partial / **M** missing / **C** conflicts), evidence (`file:line`), and a proposed change.

### D1. The invitation row (`campaign_influencers`)

List **every existing column** first, including anything unused, with its type and how it is written today. Then map these:

| Field | Rule |
|---|---|
| Set | Required. The invitation belongs to a set, not only a campaign. Confirm the set link exists and is never null for new rows. |
| Campaign | Parent of the set. |
| Creator | Required. One row per creator per set. |
| Status | See D6. |
| Invited at | When it was sent. |
| Answered at | When the creator accepted, countered or declined. |
| Invited by | The brand user who sent it, if the schema can carry it. |
| Source | Which door created it: brand picker, group invite, pitch (item 8). |
| Group it came from | Optional, for reporting only. Never shown to the creator. |
| Personal note | Optional text from the brand, ≤ 300 characters, shown to the creator. |
| Withdrawn at / removed at / by | See D9. |
| Decline reason code + free text | See D8. |

### D2. Terms — Pay for Sale (`goal = 'conversion'`)

| Field | Rule |
|---|---|
| Commission % | **Required.** Number with at most one decimal, greater than 0, at most 100 (confirm the product's real ceiling and say if a lower cap is already enforced anywhere). |
| Selling scope | One of: whole store · some categories · chosen products. Categories → a list of the brand's category ids; products → a list of product ids. Both must belong to this brand. |
| Follower offer | Optional. See D5. |
| Minimum shoppable posts | Read-only, from the platform setting. Stored on the row or read live — say which, and why. |

### D3. Terms — Pay for Content (`goal = 'engagement'`)

| Field | Rule |
|---|---|
| Fee | **Required**, whole rupees, greater than 0. |
| Deliverables | **At least one row.** Each row: type (Instagram reel, Instagram post, Instagram story, YouTube video, YouTube short) and a count of 1–20. No duplicate types. Report whether deliverables exist today as a table, a JSON column or free text, and what the deliverables job (item 3b's `apify-engagement.job.js`) expects. |
| Note to the creator | Optional, ≤ 300 characters. |
| Usage rights | Off by default. When on: duration 30 / 60 / 90 days or forever, **and** at least one place (brand's social, ads, website). |
| Payment split | 25 / 25 / 50, shown as a fact, not an input. Confirm where the split lives in code. |

### D4. Terms — Hybrid (`goal = 'hybrid'`)

Fixed fee (**required**, greater than ₹0, never zero) **plus** every Pay for Sale field. **No** deliverables and **no** usage rights: the shoppable post is the deliverable. Report whether the code today allows a hybrid row with both fee and commission and what validates it.

### D5. The follower offer on an invitation

| Case | Rule |
|---|---|
| None | Nothing stored. Shoppers pay the normal price. |
| Saved offer | Chosen from `brand_offers`. **Copied onto the invitation as a snapshot**, so later edits to the library row never change a live deal. Report whether `brand_offer_id` today is a reference or a snapshot, and which fields are copied. |
| Special offer | Created for this creator only. **Three types only:** money off (% or ₹), buy more save more, buy one get one. Applies-to: whole store / a category / chosen products — **hidden for buy one get one**. Start date (defaults to the set's posting date), optional end date. Optional "also save to my offers", which additionally writes a `brand_offers` row. |

Also report:

- the exact shape of `offer_config_json` per type, with a real example of each from production or tests;
- which offer types honour the scope today and which ignore it;
- that offers never stack, and where that is enforced;
- that commission is calculated on the discounted price, and where;
- **Gap A:** a sale doesn't record which offer produced it — propose the smallest column and write point;
- **Gap B:** an offer's start date isn't respected — propose where the check belongs;
- whether `POST /campaigns/preview-basket` can serve both preview boxes (I6, I7) unchanged, and what it needs if not.

### D6. Statuses and groupings

List every value `campaign_influencers.status` takes today, where each is written, and what reads it. Then map these groupings, which the set screen (I9) shows in this order:

1. **Waiting to answer** — sent, no reply yet.
2. **Negotiating** — a counter is open (item 6).
3. **Accepted, waiting for the agreement** — accepted, no contract signed by both.
4. **Signed** — both signatures on the contract.
5. **Declined** — the creator said no.
6. **Expired** — the cutoff passed with no reply.
7. **Withdrawn / removed** — the brand pulled it back or took the creator out.

Say which existing statuses map to which grouping, which are missing, and whether any new value is needed. Prefer reusing what exists. If a status must be added, list every switch, filter and query that must learn it.

### D7. Counts

Per set: **invited** (everyone ever invited, including declined, expired, withdrawn), **signed**, **waiting**, **declined** (declined + expired, matching item 4's line). One grouped query for a whole list, never per row. Reuse item 4's count query if it already does this; say so and cite it.

### D8. Decline

Reason code — one of: fee too low · dates don't suit · not my kind of brand · too much work · other — plus optional free text ≤ 200 characters, both visible to the brand. Report whether a decline reason exists today anywhere.

### D9. Withdraw and remove

| Action | Rule |
|---|---|
| Withdraw | Only while the creator hasn't answered. The invitation ends; the creator sees "Withdrawn" with no reason. The brand may invite the same creator again with new terms while there is still time. |
| Remove | Until the agreement is signed by both. Works from any pre-signed state, including accepted. |
| After signing | Neither is possible. The collaboration must be cancelled later (not item 5). |

Report what cancel or delete paths exist today on an invitation, whether any can destroy a contract, and what they do to money (must be nothing here).

### D10. Locks and immutability

- **Terms can never be edited after sending.** The only route to different terms is withdraw → invite again (while time remains), or a counter (item 6).
- **Sending the first invitation locks the set's Aim, posting date, mode and branch** (item 4). Report the exact code path and whether every send door goes through it.
- Report anything today that updates terms on an existing row, and every caller.

### D11. Who may be picked, and when

- Approved, active creators who pass the item 2 checks **for this set**.
- Never: someone already live in this set; a creator who blocks the brand; a creator whose settings rule out the Aim, the mode, or (for Store Visit) the branch's city.
- **Re-invitable:** someone whose earlier row in this set is declined, expired, withdrawn or removed — but only while time remains.
- Nothing at all may be sent after the set's cutoff, or while the set is expired, or while the set is a draft with a past posting date.

### D12. Batch semantics

Sending N invitations is **one** action. Say whether it should be one transaction (all or nothing) or per-creator with a partial result, and recommend one. Cover: a creator who became ineligible between picking and sending; a duplicate row; the cutoff passing mid-request.

### D13. Copying terms to everyone

"Use these terms for everyone" copies the current creator's terms to every other creator in this send. It never copies a **special** offer (per-creator by definition) — confirm this reading, or flag it as a question. Each creator can still be changed before sending. Say whether the draft of a multi-creator send lives only in the app or needs server storage, and recommend one.

### D14. Privacy

Creators never receive: the campaign description, the group they came from, other creators' terms or counts, the brand's below-minimum warnings, the brand's internal notes, or any reason for a withdrawal or removal. Brands never receive the reason a creator failed an eligibility check. Report every endpoint that would leak any of this today.

### D15. Legacy data

Existing `campaign_influencers` rows: those with no set, no terms, terms that don't match the set's Aim, an offer id pointing at a deleted offer, an accepted row with no contract, rows whose set has expired. Say what the new screens would show for each, and whether any backfill is needed (prefer none).

---

## 5. API requirements

Follow existing naming. Propose request and response shapes and error codes. Say for each whether it exists, needs extending, or is new.

| ID | Endpoint | Screens |
|---|---|---|
| A1 | **Pickable creators for a set:** the Discover query plus, per creator, `can_invite` and a reason code, and whether they are already in this set. Search, filters, sort and paging as item 3. | I1 |
| A2 | **Worked-with list for a set**, same shape as A1. | I1 |
| A3 | **Group members checked against a set:** who can be invited, who can't and why (short label), counts. | I1, I2 |
| A4 | **Eligibility check for a list of creators** against a set, returning per creator: can invite, reason, and any minimum warnings with the creator's own numbers. | I1, I3–I5, I8 |
| A5 | **Brand's saved offers** for the picker: id, name, type, a human summary, scope, dates, active flag. | I6 |
| A6 | **Offer preview:** given the offer and the commission, what a shopper pays and what the creator earns on an example product. Reuse `preview-basket` if it fits. | I6, I7 |
| A7 | **Create a saved offer** (only when "also save to my offers" is on). | I7 |
| A8 | **Send invitations:** set id, and per creator the full terms and offer choice. Validates everything, writes the rows, locks the set, notifies the creators. Returns per-creator success or failure. | I8 |
| A9 | **Set detail with its creators:** grouped as D6, each with name, avatar, a one-line terms summary, date, chip, and what the brand can do next. Counts as D7. | I9 |
| A10 | **One invitation, brand view:** the full terms as sent, the offer snapshot, the note, the timeline. | I10 |
| A11 | **Withdraw an invitation.** | I10 |
| A12 | **Remove a creator from a set.** | I10 |
| A13 | **Creator's invitations list:** brand, campaign and set names, Aim, mode, date, the money line, the cutoff and days left, plus withdrawn and expired rows. | I11, I15 |
| A14 | **One invitation, creator view:** the set terms block and the personal terms block, deliverables, usage rights, offer, note, cutoff. | I12, I13 |
| A15 | **Accept an invitation.** | I14 |
| A16 | **Decline an invitation:** reason code and optional text. | I14 |
| A17 | **Counter:** the item 6 hand-off. Report what exists; propose the smallest stub that doesn't paint item 6 into a corner. | I12 |

**Access:** every brand endpoint is for the owning brand only; every creator endpoint for that creator only. Anything else returns 404 on new endpoints (existing endpoints keep their current codes, as agreed in item 4).

---

## 6. Business rules and screen behaviour (exact)

### 6.1 Add creators (I1)

- **Header:** "Add creators", close ✕. Under it, small caps: "{CAMPAIGN} · {SET} · {SET NAME}".
- **Tabs:** All creators · Worked with · Groups.
- **Search:** "Search by name or @handle". **Filters** as item 3, including the active-filter chips.
- **Row:** avatar, name, "{niche} · {city} · {followers} IG", checkbox.
- **Ineligible row:** checkbox disabled, chip **"Can't invite"**, meta line "Not open to this set". The real reason is never shown.
- **Already in this set:** checkbox disabled and ticked, chip **"Invited"**.
- **Hint:** "Creators whose own settings rule this set out can't be picked, and the reason is never shown to them."
- **Button:** "Next: terms for {n} creators", disabled at zero.
- For a **Store Visit** set, only creators who can visit that branch's city are offered.

### 6.2 Invite a group (I2)

- **Summary card:** "**{k} of {n} can be invited**" with the set line underneath: "{group} · {Aim} · {mode} · posts {date}".
- **"Will be invited · {k}":** avatar stack and "+{n} more".
- **"Can't be invited · {m}":** one row each with a short label — "Not taking invitations", "Not open to this set", "Already in this set".
- **Hint:** "Each creator still gets their own invitation and their own terms. The group is never shown to them."
- **Button:** "Next: terms for {k} creators".

### 6.3 Terms, all Aims (I3, I4, I5)

- **Header:** "Terms · {creator}". Below it, a stepper: "Creator {i} of {n}".
- **Locked card at the top**, with a lock icon: "Set terms, same for everyone" — Aim, Posts on, Mode (with the branch name for Store Visit). Never editable here.
- **Button:** "Next creator" for all but the last, then "Review and send".
- **Minimum warning:** whenever the number is below that creator's own minimum, an amber box: "Below {first name}'s minimum of {value}. You can still invite her, and she can counter." Plus the plain hint "{First name}'s minimum for {category} is {value}." It **never blocks**.
- **"Use these terms for everyone"** switch with the hint "You can still change any creator before sending."

**Pay for Sale (I3):** Commission % (required) · "What she can sell" (Whole store / Some categories / Chosen products; picking categories or products opens a picker and the chosen ones show as tags with "Change") · "Follower offer" row showing "None" or the offer's name · "Shoppable posts" read-only with a lock: "1 post · set by INFLX".

**Pay for Content (I4):** Fee ₹ (required) with the hint "…Paid 25% on signing, 25% when the content is live, 50% after it stays live." · "What she delivers" (required): rows of type + count, ✕ to remove, "Add another", hint "Reels, posts, stories, YouTube videos and shorts." · "Anything else she should know" (optional, placeholder "Optional note for this creator") · "Brand can reuse the content" switch with the hint "Usage rights. Off unless you need it."; when on, duration chips 30 / 60 / 90 days / Forever and place chips Brand's social / Ads / Website (at least one).

**Hybrid (I5):** Fixed fee ₹ (required) with the hint "Paid whatever the sales are, in the same three parts. Can't be ₹0." · Commission % (required) · selling scope · follower offer · shoppable posts, exactly as Pay for Sale. No deliverables, no usage rights.

### 6.4 Follower offer (I6)

Bottom sheet: "**Follower offer for {first name}**". Three choices:

1. **No offer** — "Shoppers pay the normal price".
2. **Use a saved offer** — "From the offers you built on the website", then the brand's offers as radio rows with name and a one-line summary.
3. **Create a special offer** — "Only for {first name}, on this collaboration" → opens I7.

**Preview box:** "A ₹{price} {product} costs ₹{discounted}" and "{First name} earns ₹{amount} at {commission}% on what shoppers actually pay." **Button:** "Use this offer".

### 6.5 Special offer (I7)

Bottom sheet: "**Special offer for {first name}**", small caps header "FOR {CREATOR} ONLY".

- **Kind:** Money off · Buy more, save more · Buy one, get one.
- **Money off:** type % or ₹, and an amount.
- **Applies to:** Whole store / A category / Chosen products, then the picker. **Hidden for buy one, get one.**
- **From / Until:** From defaults to the set's posting date; Until defaults to "No end".
- **"Also save to my offers"** switch, off by default.
- **Preview** as in I6. **Button:** "Use this offer".

Report exactly which of these the existing engine already supports, and what each would need.

### 6.6 Review and send (I8)

- **Stepper:** "All {n} creators".
- **Locked set card:** Set name, Aim, Posts on, Mode (+ branch), **Replies close {date}**.
- **Warning when any creator is below a minimum:** "{n} creators are below their own minimum. They can still be invited and can counter."
- **One row per creator:** name, a one-line terms summary ("10% · whole store · Festive 15%", "₹8,000 · 1 reel, 2 stories"), and a chip: **Below min** (orange) or **OK** (green). Tapping a row goes back to that creator's terms.
- **Hint:** "Each creator gets their own invitation. They can accept, counter or decline until {date}."
- **Button:** "Send {n} invitations". After it succeeds: back to the set, with a toast.

### 6.7 The set after sending (I9)

- Title, campaign name, state chip, the cutoff line "Invitations close in {n} days · {date}", the progress bar and "{invited} invited · {signed} signed · {waiting} waiting · {n} declined" (item 4's line, unchanged).
- **Section headers** in the D6 order, each with a count; empty sections are hidden.
- **Rows:** name, one-line meta ("10% · sent 12 Sep", "Accepted 13 Sep", "Fee too low · 13 Sep"), and either a ⋯ or the next action chip ("Send agreement", item 7).
- **Button:** "Add creators" — hidden once the cutoff has passed.

### 6.8 One creator, and the two ways out (I10)

⋯ menu: **View terms sent** · **Open profile** · **Withdraw invitation** ("Only while she hasn't answered") · **Remove from set** ("Until the agreement is signed"), the last two in red, each hidden when not allowed.

**Withdraw confirm:** "Withdraw {first name}'s invitation?" / "She sees it as withdrawn. You can invite her again with new terms while there is still time." / **Keep** · **Withdraw**. Hint underneath: "Terms can't be edited once sent. Withdraw and invite again instead."

### 6.9 Creator · Invites (I11, I15)

- Collabs tabs: **Invites** · Active · Pitches · Done.
- **Card:** unread dot, brand logo and name, "{campaign} · {set} · {set name}", tags for Aim, mode and "Posts {date}", the money line ("You earn — 10% commission" / "₹8,000"), and the cutoff "Reply by {date} · {n} days left".
- **Accepted:** chip "Accepted" and a blue box "Waiting for the agreement from {brand}."
- **Expired:** chip "Expired", "You didn't reply by {date}, so this invitation closed."
- **Withdrawn:** chip "Withdrawn", "{Brand} withdrew this invitation on {date}."
- **Empty:** "No invitations yet" / "When a brand invites you to a set, it shows up here."
- Expired and withdrawn cards stay visible, then move to **Done**. Say when — recommend a rule.

### 6.10 Creator · the invitation (I12, I13)

Always two blocks, in this order:

1. **Locked:** "Set by the brand, same for everyone" — Aim, Posts on, Mode (city only, never the street address), Reply by.
2. **"Your terms"** — Pay for Sale: Commission "{x}% on what you sell", "You can sell {scope}", "Shopper offer {name}", "Shoppable posts — At least 1". Pay for Content: Fee, "You post {deliverables in words}", "Brand can reuse {duration} · {places}" (omitted when off), plus a tinted card "How the fee is paid": "₹{25%} when you both sign · ₹{25%} when the brand confirms your content is live · ₹{50%} after it stays live".
3. The brand's note in quotes, when there is one.
4. Hint: "Nothing is final until you both sign the agreement."
5. **Accept** (main), then **Counter** and **Decline** side by side.

After the cutoff, all three actions disappear and the card reads as expired.

### 6.11 Accept and decline (I14)

- **Accept confirm:** "Accept these terms?" / "{Brand} will send the agreement next. Nothing is final until you both sign it." / **Not yet** · **Accept**.
- **Decline sheet:** "Why are you saying no?" with chips — Fee too low · Dates don't suit · Not my kind of brand · Too much work · Other — plus "Anything else (optional)" and the hint "The brand sees this. It helps them come back with something better." Button **Decline invitation** (red). A reason is required; the text is not.

---

## 7. Validation and messages (server and app, identical text)

| Field / action | Rule | Message |
|---|---|---|
| Commission | Required, > 0, ≤ 100 | Enter a commission percentage. |
| Commission | Out of range | Commission must be between 0 and 100. |
| Fee | Required, whole rupees, > 0 | Enter a fee. |
| Hybrid fixed fee | Required, > 0 | A Hybrid set needs a fixed fee. It can't be ₹0. |
| Deliverables | At least one row | Add at least one thing she delivers. |
| Deliverable count | 1–20 | Choose between 1 and 20. |
| Deliverable type | No duplicates | You've already added that. Change the count instead. |
| Selling scope | Categories chosen but list empty | Pick at least one category. |
| Selling scope | Products chosen but list empty | Pick at least one product. |
| Usage rights | On, but no place chosen | Choose where the brand can use the content. |
| Note | ≤ 300 | Keep it under 300 characters. |
| Special offer amount | Required, > 0; % ≤ 100 | Enter the discount. |
| Special offer scope | Category or products chosen but empty | Pick what this offer applies to. |
| Special offer dates | End before start | The end date must be after the start date. |
| Below minimum | Warning only | Below {name}'s minimum of {value}. You can still invite her, and she can counter. |
| Send with nobody picked | — | Pick at least one creator. |
| Send after the cutoff | Server | Invitations for this set closed on {date}. |
| Send into an expired set | Server | This set has expired. Create a new set with a new posting date. |
| Send into a draft with a past date | Server | Pick a new posting date before you invite anyone. |
| Creator became ineligible | Server, at send | {Name} can no longer be invited to this set. |
| Duplicate live invitation | Server | {Name} is already in this set. |
| Editing sent terms | Server | Terms can't be changed once the invitation is sent. Withdraw it and invite again. |
| Withdraw after an answer | Server | {Name} has already answered, so this can't be withdrawn. |
| Remove after signing | Server | {Name} has signed, so she can't be removed here. |
| Accept or decline after the cutoff | Server | This invitation closed on {date}. |
| Accept twice | Server | You've already answered this invitation. |
| Decline with no reason | — | Choose a reason. |

---

## 8. Look and feel

Item 2's theme, already in the apps:

- White background, `#F6F6F3` surfaces, `#E5E4DE` borders, ink `#1A1A17` / `#5B5A53` / `#77766E`.
- Yellow `#FFC700` only for the single main button on a screen; red only for withdraw, remove and decline.
- Chips: Waiting = waiting blue; Accepted / OK = active green; Below min = yourMove orange; Signed = completed purple; Declined = declined red; Expired / Withdrawn = ended grey.
- Locked cards carry a lock icon and a tinted surface.
- Plus Jakarta Sans; dates "20 Oct 2026" in fields and cards, "20 Oct" in list meta; money "₹8,000"; percentages "10%".
- Bottom sheets for offers, menus and confirms, as in items 2–4.
- Loading, empty and couldn't-load states on every list, as in items 2–4.

---

## 9. Phase 1 checklist

### 9.1 Database
- Every column of `campaign_influencers` today, with type, default, who writes it and who reads it.
- Everything in §4 (D1–D15), mapped to existing columns or named as missing.
- `brand_offers` in full: columns, the five types, `offer_config_json` shapes with real examples, scope handling per type, and how an offer reaches a sale.
- `contracts`: which terms it copies at signing, and any item 5 field it can't carry.
- Deliverables: where they live today and what the deliverables job expects.
- Production counts as listed in §3's last row.
- Indexes needed for the picker, the set list and the counts.

### 9.2 Backend
- Every endpoint in §5, with what exists today, its shape, its callers and its access checks.
- Every code path that creates a `campaign_influencers` row today (brand app, website, group publish, pitch, admin, scripts, n8n) and which rules each would bypass.
- The eligibility service: signature, inputs, outputs, batch support, and whether it reads the **set's** Aim, mode and branch city.
- Where the set lock is applied, and whether every send door goes through it.
- The cutoff helper and every place a cutoff is computed.
- The expiry job as item 4 built it, and the statuses it writes.
- The counter / negotiation code that exists today, in full.
- The notification system and the templates that exist for invitations.
- The two offer fixes (Gap A and Gap B): exactly where each belongs.

### 9.3 Phone apps
- **Brand:** the item 4 set detail screen and its "Add creators" placeholder; the item 3 Discover list and what "select mode" needs; the group screens from item 3.
- **Creator:** the Collabs tab as it exists, whether an Invites tab is already there, and what it shows today.
- Components reusable from items 2–4: rows, chips, segmented control, search and filter bar, bottom sheets, confirm sheets, stepper, save bar, money and percent fields, skeletons, empty and error states, toasts.
- What must be new: the creator checkbox row, the deliverables editor, the offer sheets, the terms stepper, the invitation card and screen.
- The files and navigation entries to add per I1–I15.
- Any new native module, and whether it is OTA-safe.

### 9.4 Websites and admin
- Every screen that invites, edits terms, cancels an invitation, or edits offers.
- Confirmation that item 4's website invite switch-off is in place.
- Anything that would now break a server rule, as an open item.

### 9.5 Tests
- Baseline pass and fail counts.
- Existing tests touching invitations, terms, offers, eligibility and contracts, and which would need updating.

---

## 10. Phase 1 output

Write **`Docs/ITEM5_INVITATIONS_GAP_REPORT.md`**:

1. **Summary:** area · status · one-line gap.
2. **Requirement table:** ID · requirement · status (E/P/M/C) · evidence (`file:line`) · proposed change · risk.
3. **What already exists, in detail:** the invitation row, every door that creates one, the offer engine, eligibility, contracts, the pitch path — and which parts item 5 keeps.
4. **Link readiness (§3),** row by row.
5. **Proposed migrations** (additive), with dry-run checks and any backfill.
6. **Proposed endpoints** with shapes, error codes and affected callers.
7. **Send design:** transaction or partial, revalidation at send, locking the set, notifications.
8. **Offer design:** snapshotting, the special-offer types, the preview, and the two fixes.
9. **Status map:** existing → grouping, and anything new.
10. **Frontend plan** per screen, with components reused and components new.
11. **Test baseline** and the tests you will add.
12. **Questions for the founder,** each with your recommendation, including every assumption in §11.

Then **stop and wait for approval.**

---

## 11. Assumptions to confirm in your questions

1. **One invitation per creator per set.** A creator may hold invitations in several sets of the same campaign, and may be re-invited to the same set after a declined, expired, withdrawn or removed row.
2. **Terms are never editable after sending.** The only routes are withdraw-and-reinvite, or a counter in item 6.
3. **A saved offer is snapshotted** onto the invitation at send. Editing or deleting the library offer later changes nothing live.
4. **"Use these terms for everyone" doesn't copy a special offer**, because a special offer belongs to one creator.
5. **The multi-creator draft lives in the app** until Send, so nothing half-finished is stored on the server.
6. **The shoppable-post minimum** is a platform setting shown read-only, not a per-creator term.
7. **Usage rights are Pay-for-Content only**; Hybrid and Pay for Sale have no content package.
8. **Timezone:** cutoffs are India time and pass at the end of that day, as in item 4.
9. **A decline reason is required**, the free text optional, and the brand sees both.
10. **Withdrawn and removed creators are told plainly, with no reason**, and neither ever destroys a contract.
11. **Counter** routes to an item 6 placeholder in this build, and no negotiation logic is written now.
12. **Accepting commits nobody.** Only both signatures on the agreement do (item 7).

---

## 12. After approval (not in Phase 1)

- **Phase 2:** migrations, terms validation, the send path, withdraw and remove, accept and decline, the offer snapshot and the two offer fixes, endpoints A1–A17, notifications.
- **Phase 3:** the Brand app screens I1–I10 and the Creator app screens I11–I15, with every message from §7.
- **Phase 4:** tests. **Nothing is tested end to end until after item 7**, when the full test pack runs; until then, unit and API tests only, with no new failures.

### 12.1 Final functionality: all must pass on a phone

1. A brand opens a draft set, taps Add creators, and sees the Discover list with checkboxes.
2. A creator who doesn't accept the set's Aim, mode or city shows "Can't invite" and cannot be selected; the reason is never shown.
3. A creator already live in the set shows "Invited" and cannot be selected again.
4. A creator whose earlier row in this set was declined, expired or withdrawn **can** be selected again.
5. Inviting a group shows "{k} of {n} can be invited" with the correct split and short labels.
6. Pay for Sale terms save with a commission and a selling scope; a scope of "categories" with nothing chosen is refused with the exact message.
7. Pay for Content terms refuse an empty deliverables list, a duplicate type, and a count outside 1–20.
8. Hybrid refuses a ₹0 fixed fee.
9. Usage rights switched on with no place chosen is refused.
10. A commission or fee below the creator's minimum shows the warning, on the terms screen and on Review, and still sends.
11. "Use these terms for everyone" copies the money terms to every other creator and no special offer.
12. A saved offer attaches, and the preview shows the shopper's price and the creator's earnings.
13. Editing that saved offer afterwards does **not** change the sent invitation.
14. A special offer of each of the three kinds saves; "applies to" is hidden for buy one, get one; "also save to my offers" creates a library offer.
15. An offer whose start date is in the future is not applied before that date.
16. A sale records which offer produced it.
17. "Send {n} invitations" creates exactly n rows, notifies n creators, and makes the set live.
18. Sending locks the set's Aim, posting date, mode and branch; the API refuses to change any of them.
19. Sending after the cutoff is refused by the API with the exact message, and the app hides Add creators.
20. A creator who became ineligible between picking and sending is handled as designed, and the brand is told which one.
21. The set screen groups creators correctly and the counts line matches item 4's format, including declined.
22. Withdraw works only before an answer; the creator sees "Withdrawn" with no reason; the brand can invite her again.
23. Remove works up to both signatures and never after; no contract is ever destroyed.
24. An attempt to edit sent terms through the API is refused with the exact message.
25. The creator's Invites tab shows the card with the Aim, mode, date, money and days left.
26. The invitation screen shows the locked set block and the personal terms block, in that order, with the street address never shown.
27. A Pay for Content invitation shows the deliverables in words and the 25/25/50 split in rupees.
28. Accept moves the row to "Accepted, waiting for the agreement" on both sides and notifies the brand.
29. Decline requires a reason, stores the optional text, and the brand sees both.
30. After the cutoff, Accept, Counter and Decline disappear and the invitation reads as expired; the API refuses all three.
31. Counter opens the item 6 placeholder and writes nothing.
32. Another brand's set, invitation, withdraw or remove request returns 404; another creator's accept or decline returns 404.
33. No response to a creator ever contains the campaign description, the group, another creator's terms, or a warning.
34. Loading, empty and couldn't-load states appear on the picker, the set screen and the Invites tab, and Try again works.
35. Backend tests show no new failures against the Phase 1 baseline.

### 12.2 Final deliverable

A short summary of what changed, the test results, the result of every check 1–35, how to try the main flow on a phone, and anything left open — including whatever item 6 and item 7 will have to pick up.
