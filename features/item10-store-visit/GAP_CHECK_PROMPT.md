# INFLX — Item 10: The Store Visit shoot plan

## Phase 1: gap identification (backend, database, frontend, admin)

You are working in the INFLX codebase:

- the backend (Node, `backend/src/**`, migrations in `backend/migrations/**`, scheduled jobs in `backend/src/jobs/**`);
- the Brand and Creator phone apps (`Packages/Mobile`);
- the admin website and the brand website, which share the same backend.

Three files come with this prompt:

1. **`INFLX_Master_Business_Rules_Phase_1_v1.23.docx`**: the business rules.
   - **Main section:** **11.1 (Store Visit, written out today)**.
   - **Related:** 9 (agreement), **10 (funding, the wallet lock and shoot eligibility)**, 11 (the shoot plan generally), 12 and 12.1 (what comes after), 19, 21, 23, 24 (Needs You), 25 (deadlines), 28 (locks), 31.
2. **`INFLX_Item10_StoreVisit_Mockups.html`**: the **locked** mockups, screens **V1–V15**, plus the rules table at the end of that page.
3. **This prompt.**

**Order of authority:** rules doc → mockups → this prompt. If two disagree, stop and ask. Never guess.

> **This session is Phase 1 only.** Read and report. Do **not** change code, run migrations or edit data. Do **not** create, send, confirm or cancel anything in **production**, and do not move, lock or release money anywhere. Write the gap report (§10), then **stop and wait for approval.**

---

## 0. How to work

- **The repo is the truth.** Items 2–9 were built before this one; earlier reports are guides only. Cite **`file:line`** for every claim.
- **Items 8 and 9 have just been built.** Read them as they now stand — the pitch, the pool, the generalised negotiation anchor, the money path. Report anything either left open that item 10 depends on.
- **Something already exists here.** There is production code for a shoot, a production/`production_events` path, and at least two endpoints that reach it. **Map all of it before proposing anything**, and say for each part whether item 10 keeps it, extends it, or retires it.
- **The first job is a gate that has never existed.** §10 has always said the brand must be prevented from reaching the shoot until the money is locked and the first payment released. The item 7 survey found **no such check anywhere**, and found two endpoints — `POST /contracts/:id/production/initialise` and the auto-heal on `GET /contracts/:id/production` — that check party membership and **no status at all**. Report the current state of both, and of every other way into the shoot.
- **Migrations:** additive only. Find the next free number yourself. Dry-run and print counts.
- **Server enforcement:** every rule below is enforced on the server, not only in the app.
- **Phone apps** ship over the air. Flag any new native module — a time picker and "open in maps" are the likely candidates, and item 7 already found that **no file-viewing module is in the binary**, so check before assuming anything is available.
- **Tests:** record the backend baseline before anything. Item 10 must add no new failures.

### Words: rules doc vs code

| Rules doc / mockups | Code (verify) |
|---|---|
| Creator | `influencer` |
| Collaboration | a `campaign_influencers` row with a signed `contracts` row |
| Shoot plan | whatever the production/shoot tables are called — report their real names |
| Branch | `brand_branches` (item 3) |
| Posting date | `campaign_sets.go_live_date` |
| Mode of work | `shoot_mode = 'visit'` (Store Visit) / `'shipment'` (Remote) |
| Negotiation | item 6's thread, generalised by item 8 to hang off more than an invitation |
| Admin numbers | `platform_settings` + `platform_settings_audit` |
| Delayed collaboration | new flag; the delayed **set** is a later item |

---

## 1. Aim of this item

### 1.1 In one sentence

Item 10 lets a brand **plan a store visit** — a time, a person to ask for, and the street address the creator has never seen — lets her **accept it or ask for another time**, and lets her **mark that she attended** so the brand can confirm the shoot is done.

### 1.2 What it delivers

1. **The funding gate** §10 describes and nothing enforces, applied to every path into the shoot.
2. **The plan**: branch (inherited, locked), contact person and number, date and time, roughly how long, anything to bring or know.
3. **The address revealed at send**, not before.
4. **A time-only negotiation** through item 6's engine, with the same admin round limit.
5. **Rescheduling** by either side, and **a passed time** handled as a new time rather than a fault.
6. **She marks attended, the brand confirms**, with an admin-controlled auto-confirm.
7. **The Delayed flag** past the posting date, recording the stage, moving nothing and touching no money.

### 1.3 Why it matters

It is the first step where a person has to physically turn up somewhere, and the first that sits on top of locked money. It is also the last step before the content, where Hybrid's waiting payments finally get their trigger.

### 1.4 Out of scope

- **Remote (§11.2) is item 11.** Address, product selection, dispatch, courier, receipt, returns versus gifts — none of it here. Report anything shared so item 11 can reuse it.
- **The content step (§12) is item 12**, including the social deliverable the creator names and the confirmation that releases Hybrid's second payment.
- **The delayed-collaboration set** (§25) is a later item. Item 10 flags, nothing more.
- Transport, travel routes and costs, which §11.1 puts outside the platform deliberately.
- Money. Item 10 moves none.

---

## 2. Screen inventory (locked mockups)

| ID | Screen | App |
|---|---|---|
| V1 | The collaboration after signing: the gate as ticks, the four-step line, the posting countdown, "Plan the visit" | Brand |
| V2 | The plan: locked branch and date, contact person and number, date and time, how long, what to bring | Brand |
| V3 | Send confirm: what she gets — the full address, the number, the time | Brand |
| V4 | Active card: "Store visit planned for 18 Oct, 11:00 am" | Creator |
| V5 | What she was sent: the time, the address with Maps and call, before-you-go notes, two buttons | Creator |
| V6 | Asking for another time: round pill, date and time, old → new, why | Creator |
| V7 | Her counter, brand side: accept or suggest another — no decline | Brand |
| V8 | On the day: "I've been to the store", and "ask to move this" | Creator |
| V9 | Marked, waiting: the auto-confirm date, and that no money depends on it | Creator |
| V10 | Brand confirming: one tap, the auto-confirm date, and a new time as the quiet alternative | Brand |
| V11 | Done: both timestamps, the step line advanced, the posting countdown | Brand |
| V12 | Moving it: new date and time, old → new, why, and that it is still capped by the posting date | Brand |
| V13 | The time simply passed: no blame, one button for a new time, and a phone number | Brand |
| V14 | Past the posting date: Delayed, where it stopped, what happened to the money, and still usable | Brand |
| V15 | Creator · every other state: they moved it, confirmed by itself, delayed, nothing planned yet | Creator |

The rules table at the foot of the mockups is part of the requirement.

---

## 3. How item 10 links to the rest

Report each row as **ready / not ready**, what is missing, and what item 10 must consume or expose.

| Link | What must be true |
|---|---|
| **Item 7: the signatures** | The gate needs both `influencer_signed_at` and `brand_signed_at`. Report the canonical signed test as item 7 settled it, and confirm nothing still reads `status = 'active'` as signed. |
| **Item 9: the money** | For Pay for Content and Hybrid the gate also needs the funds locked and the first 25% released. Report exactly what is recorded when that happens — the escrow rows, the tranche-1 release, and what a reliable "is this funded" test looks like. For Pay for Sale there is nothing to check. |
| **§10's missing gate** | Report every path that reaches the shoot today: the two endpoints named in §0, the production auto-heal, any job, any admin path, and the apps. For each, what it checks now. |
| **Item 4: the branch** | The plan inherits `campaign_sets.branch_id` and it can never change. Report the branch table and what it holds — name, street address, city, state, main flag — and confirm the full address is available to the plan but not to anything the creator sees before the plan is sent. |
| **Item 4: the posting date** | The time picker is capped by `go_live_date`, and the Delayed job keys off it. Report `cutoffFor`, `earliestGoLiveDay`, `indiaDay.js` and how "today" is decided, so a shoot time is judged in India time. |
| **Item 6 / 8: the negotiation engine** | The time negotiation is the same engine with a third subject. Item 8 generalised the anchor from an invitation to a pitch — report exactly how, and what a third anchor costs. The snapshot here is one field; the round limit is the same admin number; there is no decline. |
| **Item 9: the admin settings** | The auto-confirm period joins `platform_settings`. Report the table, the cache, the audit and the data-driven admin page as item 6 and 9 left them. |
| **Item 12: what comes next** | Confirming the shoot opens the content step. Report what decides that today and what item 10 must write, without building any of item 12. |
| **Item 11: Remote** | Report what a Remote shoot plan would share with this one — the same table, the same states, the same completion — so item 11 extends rather than duplicates. |
| **Item 24: Needs You** | Four moves belong here: the brand owes a plan, she owes an answer on a time, the brand owes an answer on her counter, and the brand owes a confirmation. Report how each side's counts would learn them. |
| **Notifications** | Needed: plan sent, time countered, time agreed, time moved, visit marked attended, shoot confirmed, auto-confirmed, delayed. Report the service and the keys that exist. |
| **Admin website** | Report anything admin can see about shoots today. |
| **Existing production data** | Signed collaborations by mode, how many are Store Visit, how many have any production or shoot row, how many have a posting date already in the past, and any shoot-like row that exists without a signed contract. |

---

## 4. Data requirements

For each item report status (**E** exists / **P** partial / **M** missing / **C** conflicts), evidence (`file:line`), and a proposed change.

### D1. The shoot plan

List **every existing column** of whatever shoot or production table exists, with writer and reader. Then map:

| Field | Rule |
|---|---|
| Collaboration | One shoot plan per collaboration. Say whether a unique constraint exists and propose one if not. |
| Mode | Inherited from the agreement, never editable here (§11). |
| Branch | Inherited from the set, never editable. Store the id, and snapshot the address as it stood when the plan was sent. |
| Contact person, contact number | Required. Revealed to the creator only when the plan is sent. |
| Date and time | Required. A real timestamp, judged in India time. |
| Roughly how long | Optional, free text. |
| Anything to bring or know | Optional, free text, ≤ 500 characters. |
| Sent at, sent by | When the plan went to her. |
| Agreed at | When the time was agreed, by acceptance or by the end of a negotiation. |
| Attended at | When **she** marked it. |
| Confirmed at, confirmed by, auto-confirmed | When the brand confirmed, who, or that it confirmed itself. |
| Auto-confirm due at | Stamped when she marks attended, from the admin number. |
| State | Not sent · sent · time agreed · attended · complete, plus Delayed as a flag on top rather than a state of its own. |

**Snapshotting the address:** the branch could be edited or deleted after the plan is sent. Say what the creator should see then, and recommend — my expectation is the plan keeps what it sent.

### D2. The funding gate

| Aim | What must be true before the shoot opens |
|---|---|
| Pay for Sale | Both signatures. Nothing else; there is no fixed money. |
| Pay for Content | Both signatures, the funds locked, the first 25% released. |
| Hybrid | The same as Pay for Content. |

Report a single function that answers this, where it must be called, and **every path that must call it**. A gate enforced on one screen is not enforced.

### D3. The time

- Never later than the set's posting date. Report where that cap belongs so the app and the server agree.
- Judged in India time, like every other date in the product.
- Say whether a minimum notice is needed (a plan sent for two hours' time) and recommend — I lean towards none, because a brand and creator who have agreed it verbally should not be blocked.

### D4. The negotiation

Item 6's engine with a third subject. The snapshot is `{ visitAt }` and nothing else. The same admin round limit, stamped when the thread starts. **No decline** — the only alternative to accepting is proposing another time. Report what item 8's anchor generalisation left behind and precisely what a third anchor touches.

### D5. Rescheduling

Either side, any time before the visit happens, before or after agreement. The **same thread reopens** rather than a new one starting. Still capped by the posting date. Report whether reopening a thread that has ended is possible in the engine as it stands, and what it costs.

### D6. A time that passes

If the agreed time passes with nothing marked: no fault is recorded against either side, nothing changes state, and the brand can send a new time. Report how "passed" is decided and whether anything needs to run to notice it, or whether it can be derived.

### D7. Marking it done

| Rule | Detail |
|---|---|
| She marks attended | Only she can. Only once the plan has a time and, sensibly, not before the day — say whether you would allow marking early and recommend. |
| The brand confirms | One action. Records who. |
| Auto-confirm | An admin number, three days by default, **stamped when she marks attended**. A job confirms it and records that it was automatic. |
| Idempotency | Marking or confirming twice, or two devices at once, must produce one of each. |
| No money | Nothing here locks, releases or refunds anything. State this in the report explicitly, because it is what makes the auto-confirm safe. |

### D8. Delayed

A job marks the collaboration Delayed the day after the posting date when the shoot is not complete. It records **when** and **the stage it stopped at** — plan not sent, sent but no time agreed, time agreed but not attended, attended but not confirmed. Both sides are told once. **Nothing else happens:** the collaboration stays in its set, the shoot stays fully usable, no money moves, no invitation or contract changes.

Report where the flag belongs so the later delayed-set item can act on it, and confirm item 4's set-expiry job and its counts are unaffected.

### D9. Privacy

Before the plan is sent she sees the branch's **city only**, as the agreement gives it. The street address and the contact number arrive with the plan. The brand never sees anything new about her here. Report every endpoint that would leak the address earlier.

### D10. Legacy data

Signed Store Visit collaborations that already exist, any production rows without a signed contract, and any collaboration whose posting date has already passed. Say what each would show on the new screens and whether any backfill is needed. **Prefer none.**

---

## 5. API requirements

Follow existing naming. Propose request and response shapes and error codes. Say for each whether it exists, needs extending, or is new.

| ID | Endpoint | Screens |
|---|---|---|
| F1 | **The collaboration's shoot state**, both sides: the gate result, the plan if there is one, the thread if there is one, what this side can do now. | V1, V4, V5, V8, V11 |
| F2 | **Create or update the plan before sending** — contact, number, date, time, how long, notes. | V2 |
| F3 | **Send the plan** — validates the gate, the branch, the time against the posting date; snapshots the address; notifies her. | V3 |
| F4 | **She accepts the time.** | V5 |
| F5 | **Counter the time** (both sides) and **the thread** — item 6's endpoints with a shoot plan as the subject. | V6, V7 |
| F6 | **Reschedule** — the same thread reopened, either side. | V12 |
| F7 | **She marks attended** — stamps the auto-confirm due date. | V8 |
| F8 | **The brand confirms** — completes the shoot and opens the content step. | V10 |
| F9 | **Job:** auto-confirm at the due date; mark Delayed the day after the posting date. Idempotent, logged. | V9, V14, V15 |
| F10 | **The admin number** on item 9's settings page. | — |

**Access:** brand endpoints for the owning brand, creator endpoints for that creator, everything else 404. Every one of them behind the gate.

---

## 6. Business rules and screen behaviour (exact)

### 6.1 The collaboration, brand side (V1)

- Header is her name; under it the campaign and set in small caps, then "{Aim} · {Mode}" with an Active chip.
- **The gate card**, green, one line per condition with a tick: "Signed by both on {date}", "₹{n} locked", "₹{n} released to {name}". Pay for Sale shows only the signature line. A condition not yet met shows an hourglass instead of a tick and the card is blue.
- **The step line:** Agreement signed · Shoot plan · Content · Live and paid, with the current one marked.
- The posting countdown: "She posts on {date} · {n} days".
- Button: "Plan the visit".

### 6.2 The plan (V2, V3)

- A locked card: Mode, Branch, She posts on — all from the set.
- "Who she should ask for" and "Their number", both required, with the hint "She sees this once you send the plan."
- Date and time side by side, with the hint "Dates after {posting date} aren't offered — she can't shoot after the day she posts."
- "Roughly how long" and "Anything she should bring or know", both optional.
- Button "Send to {first name}". The confirm lists what she gets — the full address, the number, the time — then: "She can accept the time or ask for a different one. She can't change anything else — the branch and the posting date came from the set."

### 6.3 Her side (V4, V5)

- The Active card carries one line: "Store visit planned for {date}, {time}".
- The visit screen: a dark time card with the date and "About {n} hours"; the address card with the branch name, the street address, **Open in Maps** and a call button for the contact; a "Before you go" card when there are notes; then the plain line "You post on {date}, so this has to happen before then. Ask for another time if {date} doesn't work."
- Two buttons: **This time works** and **Ask for another time**.

### 6.4 The time negotiation (V6, V7)

- Her sheet: the round pill, date and time, the change line "They asked for {old} → {new}", an optional why, and "Only the time can change. The branch and the {date} posting date came from the set."
- The brand's thread: item 6's turn cards, her request on top, the plan as the opening turn shown as plain values.
- Two buttons: **Accept {new time}** and **Suggest another time**, with the hint "There is no declining a time. If it can't work, suggest a different one."

### 6.5 The visit (V8–V11)

- Once agreed, her card shows "Time agreed on {date}" in green and the time card says "Today" on the day.
- **"I've been to the store"**, with the hint "Tap this after your visit. {Brand} confirm it, and then you shoot and upload." Plus a quiet "Ask to move this".
- After marking: a blue box "You marked this done on {date}. Waiting for {Brand} to confirm.", then "If they don't confirm by {date} it confirms itself and you can start uploading. **Nothing about your payment depends on this step.**"
- The brand sees "Your move. {Name} says she visited on {date}", the time card, "Confirming opens her content step. If you do nothing, this confirms itself on {date}.", **Confirm the shoot is done**, and a quiet "She didn't come — send a new time".
- Done: green "Shoot done on {date}. {Name} is working on the content.", the step line advanced, and a record card — Branch, When, She marked it, You confirmed.

### 6.6 Moving it, and missing it (V12–V15)

- **Move:** new date and time, the change line, an optional why, and "{Name} has to agree the new time. It still has to be before {posting date}."
- **Passed:** amber "The {date} visit came and went with nothing marked.", the time card reading "Passed", then "Nobody is blamed for this. Sort it out with {name} however you like, then send a new time — there are {n} days before she posts." One button, plus a call link.
- **Delayed:** a Delayed chip, an amber box "The {date} posting date passed before the shoot happened. This is now a delayed collaboration.", a "Where it stopped" card — Stage, Agreed time, Delayed since — then "Nothing has changed about the money: ₹{n} is still locked and {name} keeps the ₹{n} she was paid at signing. You can still plan a visit and carry on." The button still works.
- **Her states:** they moved it (with their reason), confirmed by itself, delayed (with what it means for her money), and nothing planned yet.

---

## 7. Validation and messages (server and app, identical text)

| Field / action | Rule | Message |
|---|---|---|
| Reaching the shoot unsigned | Server | This collaboration isn't signed by both of you yet. |
| Reaching the shoot unfunded (PfC / Hybrid) | Server | The money for this collaboration isn't locked yet. |
| Contact person | Required | Enter who she should ask for. |
| Contact number | Required, a valid Indian mobile | Enter a contact number. |
| Date and time | Required | Choose a date and time. |
| Time after the posting date | Server | The visit has to be before {date}, the day she posts. |
| Time in the past | Server | Choose a time in the future. |
| Notes | ≤ 500 | Keep it under 500 characters. |
| Sending twice | Server | A plan is already with {name}. |
| Editing a sent plan | Server | Send a new time instead of changing this one. |
| Countering after agreement | Server | The time is already agreed. Ask to move it instead. |
| Rounds used up | Server | There are no counters left. You can accept this time or ask to move it. |
| She marks attended before the plan has a time | Server | The time hasn't been agreed yet. |
| Marking or confirming twice | Server | This is already marked. |
| Brand confirming before she marks | Server | {Name} hasn't said she visited yet. |
| Mode is Remote | Server | This is a Remote collaboration. Products are shipped to {name}. |

---

## 8. Look and feel

Item 2's theme, as items 3–9 use it:

- White background, `#F6F6F3` surfaces, `#E5E4DE` borders, ink `#1A1A17` / `#5B5A53` / `#77766E`.
- Yellow `#FFC700` for the single main button; red only where something ends, of which there is nothing in item 10.
- The gate card is the active-green family when satisfied, waiting-blue when not.
- The time card is **solid ink with white text** when it is the live agreed time, and a grey surface once it is past or historic.
- The Delayed chip and its box are the yourMove-amber family — it needs attention, nothing is lost.
- The step line: a filled green dot for done, an amber ring for now, an empty ring for later.
- Plus Jakarta Sans; dates "Sun 19 Oct, 4:00 pm" on the time card, "19 Oct" in lists, money "₹9,720".

---

## 9. Phase 1 checklist

### 9.1 Database
- Every column of the existing shoot/production tables, with writer and reader.
- Everything in §4 (D1–D10) mapped to a column or named as missing.
- `brand_branches` as item 3 built it, and what the full address looks like.
- `platform_settings` and its audit.
- Production counts from §3's last row.
- Indexes for both sides' lists and for the two job lanes.

### 9.2 Backend
- Every endpoint in §5, with what exists today, its shape, its callers and its access checks.
- **Every path into the shoot**, and what each checks now.
- The signed test and the funded test, and where a single gate function belongs.
- Item 6's engine and item 8's anchor generalisation, in full, and the cost of a third subject.
- The jobs runner and where the two new lanes fit.
- The notification service and the keys that exist.

### 9.3 Phone apps
- **Brand:** the collaboration screen as item 7 left it, and where "Plan the visit" attaches.
- **Creator:** the Active tab as item 7 built it.
- Components reusable from items 2–9: cards, sheets, confirm sheets, chips, turn cards, the round pill, state boxes, the date field, skeletons, empty and error states.
- What is new: the gate card, the step line, the time card, the address card with Maps and call.
- **Check before assuming:** is there a time picker in the binary, and can the app open a maps URL and a phone number? Say plainly whether each is OTA-safe.

### 9.4 Websites and admin
- Anything that touches shoots today; the new number on item 9's settings page.

### 9.5 Tests
- Baseline pass and fail counts; existing tests touching contracts, production, escrow and the jobs.

---

## 10. Phase 1 output

Write **`Docs/ITEM10_STOREVISIT_GAP_REPORT.md`**:

1. **Summary:** area · status · one-line gap.
2. **Requirement table:** ID · requirement · status · evidence (`file:line`) · proposed change · risk.
3. **The gate, first and in full:** every path into the shoot, what each checks today, and the single function that will answer it.
4. **What already exists, in detail:** the shoot/production tables and code, and which parts item 10 keeps, extends or retires.
5. **Link readiness (§3),** row by row.
6. **The third anchor:** what item 8 left behind, and exactly what a shoot-plan subject touches.
7. **Proposed migrations** (additive), with dry-run checks.
8. **Proposed endpoints** with shapes, error codes and affected callers.
9. **The two job lanes:** auto-confirm and Delayed, and how each is proved idempotent.
10. **Frontend plan** per screen, components reused and new, and the native-module answer.
11. **What item 11 will share**, so Remote extends this rather than copying it.
12. **Test baseline** and the tests you will add.
13. **Questions for the founder,** each with a recommendation, including every assumption in §11.

Then **stop and wait for approval.**

---

## 11. Assumptions to confirm in your questions

1. **The gate is both signatures, plus funded for Pay for Content and Hybrid**, and it is enforced on every path, not one screen.
2. **One shoot plan per collaboration**, with the branch and mode inherited and never editable.
3. **The full address and the contact number are revealed when the plan is sent**, and never before.
4. **The plan keeps the address it sent**, even if the branch is later edited or deleted.
5. **Only the time is negotiable**, through item 6's engine, with the same admin round limit and no decline.
6. **No time after the posting date** is ever offered or accepted.
7. **Either side may reschedule** before the visit, reopening the same thread.
8. **A passed time is nobody's fault** and records nothing against either side.
9. **She marks attended; the brand confirms; three days auto-confirms** — safe because no money moves.
10. **Past the posting date the collaboration is flagged Delayed**, records its stage, and nothing else changes.
11. **Item 10 moves no money at all.**
12. **Remote is item 11** and shares this plan's shape wherever it can.

---

## 12. After approval (not in Phase 1)

- **Phase 2a:** the gate, on every path, before any feature work.
- **Phase 2b:** the migration, the plan, the send, the time negotiation, rescheduling, attend and confirm, the two job lanes, the admin number, notifications.
- **Phase 3:** the Brand screens V1–V3, V7, V10–V14; the Creator screens V4–V6, V8, V9, V15.
- **Phase 4:** tests.

### 12.1 Final functionality: all must pass

1. A Pay for Content collaboration that is signed but somehow unfunded cannot reach the shoot, from **any** path, including the two endpoints that check nothing today.
2. A Pay for Sale collaboration reaches the shoot on both signatures alone.
3. An unsigned collaboration reaches the shoot from no path at all.
4. The gate card shows the real conditions per Aim, with ticks and amounts that match the money that actually moved.
5. The plan inherits the branch and mode and neither can be changed, by the app or the API.
6. The time picker offers no date after the posting date, and the API refuses one.
7. A time in the past is refused.
8. Sending the plan reveals the street address and the contact number to her, and nothing before it does.
9. Editing a sent plan is refused; a new time is the only route.
10. She accepts the time and both sides see it agreed.
11. She counters the time: item 6's thread opens with the plan as turn zero, the round limit is the admin number, and there is no decline anywhere in it.
12. The round limit is enforced identically to an invitation and a pitch.
13. Either side reschedules an agreed time and the same thread reopens rather than a second one starting.
14. A rescheduled time after the posting date is refused.
15. The agreed time passes: nothing changes state, no fault is recorded, and the brand can send a new time.
16. She marks attended; the auto-confirm date is stamped from the admin number and shown to both.
17. The brand confirms; the shoot completes; the content step opens.
18. The brand does nothing: the job confirms it at the due date, records that it was automatic, and tells both.
19. Changing the admin number afterwards does not move a due date already stamped, and does apply to the next one.
20. Marking or confirming twice, or from two devices at once, produces exactly one of each.
21. **No money moves anywhere in the whole of item 10** — no lock, no release, no refund — proved by checking balances and escrow before and after a complete shoot.
22. Past the posting date the collaboration is marked Delayed, with the correct stage recorded, and both sides told once.
23. A delayed collaboration can still be planned, agreed, attended and confirmed.
24. A delayed collaboration stays in its set, and item 4's counts and expiry are unaffected.
25. The creator never sees the branch's street address or the contact number before the plan is sent.
26. A Remote collaboration cannot use any of these endpoints, and says why.
27. Another brand's or another creator's shoot plan, thread or action returns 404.
28. Needs You shows the right move to the right side at each of the four points.
29. Loading, empty and couldn't-load states appear on both sides' shoot screens.
30. Backend tests show no new failures against the Phase 1 baseline.

### 12.2 Final deliverable

A short summary of what changed, the gate stated first with every path it now covers, the test results, the result of every check 1–30, what item 11 can reuse, and anything left open.
