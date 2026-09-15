# INFLX — Item 8: The creator's pitch

## Phase 1: gap identification (backend, database, frontend, admin)

You are working in the INFLX codebase:

- the backend (Node, `backend/src/**`, migrations in `backend/migrations/**`, scheduled jobs in `backend/src/jobs/**`);
- the Brand and Creator phone apps (`Packages/Mobile`);
- the admin website and the brand website, which share the same backend.

Three files come with this prompt:

1. **`INFLX_Master_Business_Rules_Phase_1_v1.21.docx`**: the business rules.
   - **Main section:** **8 (Creator Pitching, rewritten today)**.
   - **Amended to match:** **7B** (a creator invited from her own pitch) and the admin settings list.
   - **Related:** 4, 5, 5B, 6, 7, 7A, 8A (pitch and invitation settings), 9, 24, 25, 30, 31.
2. **`INFLX_Item8_Pitch_Mockups.html`**: the **locked** mockups, screens **T1–T14**, plus the rules table at the end of that page.
3. **This prompt.**

**Order of authority:** rules doc → mockups → this prompt. If two disagree, stop and ask. Never guess.

> **This session is Phase 1 only.** Read and report. Do **not** change code, run migrations or edit data. Do **not** create, send, accept or reject anything in **production**, and do not move money anywhere. Write the gap report (§10), then **stop and wait for approval.**

---

## 0. How to work

- **The repo is the truth.** Items 2–7 were built before this one; earlier reports are guides only. Cite **`file:line`** for every claim.
- **Item 7 has just been built.** Read it as it now stands, along with item 6's pool and negotiation and item 5's send path. Item 8 adds a front door and then hands over to all of them.
- **This item is mostly a deletion.** There is already a pitch machine — its own tables, its own negotiation with a per-side round cap, its own TTL, and a "brief into a set" path that skips eligibility and can create an accepted invitation with a contract in one step. **Map all of it before proposing anything**, and say for each part whether item 8 keeps it, rewires it, or retires it. The rules now say there is **no separate route into a collaboration for a pitch**.
- **Migrations:** additive only. Find the next free number yourself. Dry-run and print counts.
- **Server enforcement:** every rule below is enforced on the server.
- **Phone apps** ship over the air. Flag any new native module.
- **Tests:** record the backend baseline before anything. Item 8 must add no new failures.

### Words: rules doc vs code

| Rules doc / mockups | Code (verify) |
|---|---|
| Creator | `influencer` |
| Pitch | the existing pitch / handshake tables — report their real names |
| Agreed pitch | today `collab_agreements`; from now, a pool entry (item 6) |
| The pool | `brand_creator_pool` (item 6) |
| Invitation | a `campaign_influencers` row |
| Negotiation | item 6's thread — `negotiations` + `negotiation_turns` with `round_limit` and `terms_json` |
| Pitch settings | the brand side of §8A (item 2) |
| Invitation settings | the creator side of §8A (item 2) |
| Cooldown | new |
| Admin numbers | item 6's `platform_settings` + `platform_settings_audit` |

---

## 1. Aim of this item

### 1.1 In one sentence

Item 8 lets a creator **propose a deal to a brand**, and lets the brand **accept, counter or reject** — where accepting agrees the money and puts her in the brand's **pool**, not into a collaboration.

### 1.2 What it delivers

1. **Finding a brand and pitching it**, with only the Aims that brand accepts, checked against its pitch settings before she can send.
2. **The pitch itself** per Aim, carrying the money, the deliverables where relevant, **when she could post**, **how she'd work**, and her message.
3. **Limits**: one open pitch per brand per Aim, at most three open to one brand.
4. **The brand's three answers**, with her numbers on the card.
5. **Negotiation through item 6's engine**, with her pitch as the first turn — retiring the second engine.
6. **Acceptance creating a pool entry**, after which item 6, item 4, item 5 and item 7 do everything.
7. **A response period** (admin, 30 days) with reminders, an early close when her date nears, and expiry.
8. **A rejection cooldown** (admin, 30 days) on her pitching that brand — never on the brand inviting her.
9. **Every ending on both sides**, said plainly.

### 1.3 Why it matters

It is the second way into the product and the one that costs the brand nothing to ignore, so it has to be cheap for her to send and honest about what happens next. It is also the last item before the end-to-end test pack.

### 1.4 Out of scope

- Everything after the pool: the set, the invitation, the agreement. Those are items 4, 5 and 7, unchanged.
- Brand-side pitch settings and creator-side invitation settings (item 2), except to read them.
- Discovery of brands (item 3), except to add the pitch action.
- Money. Nothing here moves any.

---

## 2. Screen inventory (locked mockups)

| ID | Screen | App |
|---|---|---|
| T1 | Find a brand: search, filters, Accepting / You don't match / Not accepting | Creator |
| T2 | The pitch, Pay for Sale: only accepted Aims, commission, selling intent, her minimum as a hint | Creator |
| T3 | The pitch, Pay for Content: fee, deliverables, when she could post, how she'd work | Creator |
| T4 | Review and send: the summary, her message with a counter, the deadline, the next step, the limit | Creator |
| T5 | The pitches list, grouped New / Talking, with her numbers on the card | Brand |
| T6 | One pitch: her profile, her numbers, what she proposes, her message, the deadline, three buttons | Brand |
| T7 | Accept confirm: agreed · goes to your pool · not a collaboration | Brand |
| T8 | Reject sheet: optional reason, the cooldown stated, blocking offered as the other answer | Brand |
| T9 | The thread, brand side, with her pitch as the opening turn | Brand |
| T10 | The thread, creator side, last round | Creator |
| T11 | The pool with pitch entries beside move requests, provenance tag, and a "Not available" group | Brand |
| T12 | Her invitation, from the pitch, with the green line | Creator |
| T13 | Her pitches: waiting, agreed, rejected with the cooldown date | Creator |
| T14 | Every other state: no reply, withdrawn, date passed, limit reached, empty | Creator |

The rules table at the foot of the mockups is part of the requirement.

---

## 3. How item 8 links to the rest

Report each row as **ready / not ready**, what is missing, and what item 8 must consume or expose.

| Link | What must be true |
|---|---|
| **Item 2: the brand's pitch settings** | Accepting pitches, Aims, modes, niche, minimum followers and engagement, languages and cities, blocked, and "always allow creators we have worked with". Report the service that checks a creator against a brand — the mirror of `canBrandInviteCreator` — and whether it returns the coarse reason codes the brand list needs. |
| **Item 2: her invitation settings** | Read only where §7B now says they apply (the invitation from the pool). Her **minimum fee and commission** are shown to her as hints on the pitch form — confirm they can be read for her own screen. |
| **Item 3: the brand list** | T1 is item 3's brand list with a pitch action. Report the endpoint, its filters and paging, and what the three status chips come from today. |
| **Item 3b: her numbers** | T5 and T6 show followers and engagement from the measured numbers, with "—" when not measured. Confirm they are available on a pitch payload. |
| **Item 6: the negotiation engine** | The rules now say pitch negotiation **is** item 6's mechanism. Report what it would take for a thread to hang off a pitch as well as an invitation, in full: the tables, the `subject` shape, `current_turn`, `round_limit`, `terms_json`, `outcome`, and every query that assumes `campaign_influencer_id`. Recommend either generalising it or the smallest honest alternative, and say what each costs. |
| **Item 6: the old pitch negotiation** | Report the existing pitch round machinery completely — tables, the per-side cap, the TTL, its endpoints and its callers — and what retiring it affects. |
| **Item 6: the pool** | Accepting creates a `brand_creator_pool` entry. Report the table as item 6 built it and confirm it can carry a pitch's provenance, the Aim, the agreed terms, and what she asked for. Report how `state` and `expires_at` behave, and whether the entry needs a new source value. |
| **Item 6: platform settings** | The response period and the cooldown join that page. Report the table, the cache, the audit and the admin page as item 6 built them. |
| **Item 5: the send path** | An invitation from a pitch-originated pool entry goes through item 5's batch send unchanged. Report the `source` CHECK and whether `pool` covers it or a `pitch` value is needed for reporting. |
| **Item 5 / 7: the brief path** | `invite` with `agreement_id` skips eligibility and can jump to accepted with a contract. Report it in full, every caller, and what breaks if it is retired. **This is the path item 8 replaces.** |
| **Item 7: the agreement** | Nothing changes. Confirm an invitation created from a pitch-originated pool entry reaches item 7 exactly like any other. |
| **Item 24: Needs You** | The brand owes an answer on a new pitch and on a counter; she owes an answer on a counter. Report how each side's counts would learn them. |
| **Notifications** | Needed: pitch received, reminder at 7 and 21 days, countered, agreed, rejected (with the reason and the cooldown date), withdrawn, no reply, closed because the date passed. Report the keys that exist. |
| **Admin website** | Report anything admin can see about pitches today. |
| **Existing production data** | `collab_agreements` by state (19 ready / 2 consumed / 1 expired at last count), pitches by status, pitch negotiations and turns, how many invitations were created through the brief path, and any cooldown-like data. |

---

## 4. Data requirements

For each item report status (**E** exists / **P** partial / **M** missing / **C** conflicts), evidence (`file:line`), and a proposed change.

### D1. The pitch

List **every existing column** of the current pitch table(s) first, with writer and reader. Then map:

| Field | Rule |
|---|---|
| Creator, brand | Owner and target. |
| Aim | One of the three, and one the brand accepts. |
| Terms | Pay for Sale: commission %, optional selling intent. Pay for Content: fee and deliverables. Hybrid: fixed fee and commission. **Same shapes and same validator as item 5**, not a second set. |
| When she could post | A date. Used to build the set and to close the pitch early. |
| How she'd work | Store Visit or Remote. |
| Message | Required, ≤ 500 characters. |
| Sent at, response due at | `response_due_at` **stamped at send** from the admin setting. |
| Status | Open · countering · agreed · rejected · withdrawn · expired (no reply) · closed (date passed). |
| Answered at, answered by | When and who. |
| Rejection | Reason text (optional, ≤ 200) and the cooldown end date, stamped at rejection. |
| Pool entry | The entry acceptance created. |

### D2. What a pitch may contain, per Aim

| Aim | Fields | Never |
|---|---|---|
| Pay for Sale | Commission %, optional selling scope | Follower offer, usage rights, shoppable-post minimum |
| Pay for Content | Fee, deliverables (types and counts) | as above |
| Hybrid | Fixed fee and commission % | as above, and no deliverables |

All three also carry the date, the mode and the message. Every numeric limit is item 5's: commission 0 < x ≤ 100 to one decimal, whole-rupee fees above zero, deliverables 1–20 with no repeated type.

### D3. Who may pitch

The brand's §8A settings, checked **on send**, server-side: accepting pitches, the Aim, the mode, niche, minimum followers, minimum engagement, languages and cities, not blocked — with "always allow creators we have worked with" overriding the soft ones but never Paused or Blocked. The pitch form offers **only the Aims and modes that brand accepts**. Report the service, and whether the brand list can carry a per-brand `canPitch` and a coarse reason.

### D4. Limits

- One **open** pitch per brand per Aim.
- At most **three open** pitches to any one brand.
- No limit across different brands.
- Open means not yet agreed, rejected, withdrawn, expired or closed. Report how you would enforce both cheaply, and whether a partial unique index can do the first.

### D5. How long a pitch stays open

| Rule | Detail |
|---|---|
| Response period | Admin number, 30 days by default, **stamped on the pitch at send**. |
| Reminders | To the brand at 7 days and at 21 days, once each. |
| Early close | When her proposed posting date comes within 7 days, because no set can be built for it. Report where item 4's 7-day rule lives so the same constant is used. |
| Expiry | Whichever comes first closes the pitch. She may pitch that brand again immediately. |
| Withdraw | Any time before the agreement is signed. After acceptance that means leaving the pool, which item 6 already supports. |

### D6. Negotiation

Item 6's engine, with the pitch as the subject and her pitch as turn zero: the same admin round limit stamped at the start, `terms_json` per turn, whole-counter acceptance, no automatic decline, and the same "what changed" display. Report precisely what must change for the thread to attach to a pitch, and list every query, service and screen that assumes an invitation.

### D7. Acceptance

Accepting — from the pitch screen or from the thread — creates a **pool entry** and **nothing else**: no campaign, no set, no invitation, no contract, no money. The entry carries the Aim, the agreed terms in the pool's shape, the date and mode she asked for, and provenance pointing at the pitch. The pitch becomes `agreed` and links to the entry. Report whether the pool's lifetime should be stamped from the same setting as item 6 (recommend yes) and what happens to the pitch when the entry is used, expires or is removed.

### D8. Rejection and the cooldown

| Rule | Detail |
|---|---|
| Cooldown | Starts on rejection. Admin number, 30 days by default, **stamped at rejection**. Per **brand**, not per Aim. |
| Scope | Blocks only **her pitching that brand**. Never blocks the brand inviting her, and never blocks her accepting an invitation. |
| Told | She sees the date she may pitch again. The brand sees it before it taps Reject. |
| No cooldown | Withdrawn, expired unanswered, or closed because the date passed. |
| Blocking | Unchanged from item 2, and offered on the reject sheet as the other answer. |

Report where a cooldown would be stored so the pitch form can check it in one query, and what happens to an existing cooldown if the brand later blocks or unblocks her.

### D9. Her settings on the way back

§7B, as amended: for a set that matches what was agreed — same Aim, same mode — her Aim, mode, city, category and minimum settings are **not** applied against her. For a set that differs, every setting applies. **Always applied:** paused, and blocked. Where an entry can't be used the brand is told only that she is not available.

Report exactly where this belongs in item 5's send path and item 6's pool read, and how the pool row knows which case it is in.

### D10. Privacy

The brand sees her profile, her numbers, her terms and her message. She never sees the brand's internal notes, its other pitches, its budgets, or why she failed a setting. Report any endpoint that would leak any of it.

### D11. Legacy data

`collab_agreements` rows (ready, consumed, expired), old pitch rows and old pitch negotiations, and invitations created through the brief path. Say what each would show on the new screens and whether any backfill is needed. **Prefer none.**

---

## 5. API requirements

Follow existing naming. Propose request and response shapes and error codes. Say for each whether it exists, needs extending, or is new.

| ID | Endpoint | Screens |
|---|---|---|
| E1 | **Brands she can pitch** — item 3's list plus `canPitch`, a coarse reason, the Aims and modes that brand accepts, and any cooldown end date. | T1 |
| E2 | **What this brand accepts** — for the form: Aims, modes, and her own minimums for the hints. | T2, T3 |
| E3 | **Send a pitch** — Aim, terms, date, mode, message. Validates the settings, the limits, the cooldown and the terms; stamps `response_due_at`. | T4 |
| E4 | **Her pitches** — grouped, with the deadline, the state, the reason and the cooldown date. | T13, T14 |
| E5 | **Withdraw a pitch.** | T14 |
| E6 | **The brand's pitches** — grouped New / Talking / answered, with her numbers and a one-line terms summary. | T5 |
| E7 | **One pitch, brand view** — her profile summary, numbers, terms, message, deadline, and what it can do now. | T6 |
| E8 | **Accept** — creates the pool entry, marks the pitch agreed, notifies her. | T7 |
| E9 | **Reject** — optional reason, stamps the cooldown, notifies her with the date. | T8 |
| E10 | **Counter** (both sides) and **the thread** — item 6's endpoints, with a pitch as the subject. | T9, T10 |
| E11 | **Job:** reminders at 7 and 21 days; expire at the response deadline; close early when the proposed date comes within 7 days. Idempotent, logged. | T13, T14 |
| E12 | **Admin settings** — the response period and the cooldown on item 6's page. | — |

**Access:** creator endpoints for that creator, brand endpoints for the owning brand, everything else 404.

---

## 6. Business rules and screen behaviour (exact)

### 6.1 Finding a brand (T1)

- Item 3's list: search by name, filters, brand card with logo, name, categories and city.
- A chip per brand: **Accepting** (green) · **You don't match** (red) · **Not accepting** (grey), with one plain line under the last two — "They're looking for creators in other niches."
- A brand in cooldown shows the date she may pitch again and cannot be pitched.

### 6.2 The pitch form (T2, T3)

- Header "Pitch {brand}", with the brand's name, categories and city at the top.
- **What kind of deal:** only the Aims that brand accepts, as option boxes, with a line naming what they don't take — "Urban Threads don't take Pay for Content pitches."
- **Pay for Sale:** "Commission you want" with her own minimum as a hint; "What you'd like to sell".
- **Pay for Content:** "Fee you want" with her minimum and the 25/25/50 line; "What you'd deliver" as rows of type and count.
- **Hybrid:** the fixed fee and the commission.
- **When you could post:** a date, with the hint "They'll build a set around this. It can move when you talk."
- **How you'd work:** only the modes that brand accepts.

### 6.3 Review and send (T4)

- A summary card of everything she chose.
- **"Why you"**, required, ≤ 500 characters, with a counter.
- The plain paragraph: "{Brand} have {n} days to reply. If they agree, they'll invite you to a set with these terms and you'll sign an agreement then. Nothing is committed until you both sign."
- The limit line: "Your 1st open pitch to {brand} · 3 allowed".
- Button: "Send pitch".

### 6.4 The brand's list and one pitch (T5, T6)

- Grouped **New** (unread, your move) and **Talking** (a thread is open), each with a count; answered pitches leave the list.
- Card: unread dot, avatar, name, "{niche} · {city} · {n} days ago", a Your move chip, her three numbers, and tags for the Aim, the money and the date.
- One pitch adds her languages, her message in quotes, the deadline as "Reply by {date} · {n} days left", then **Accept her terms** (main), **Counter** and **Reject**, and a link to her full profile.

### 6.5 Accepting (T7)

The confirm lists three things: "Her ₹{n} — Agreed", "She goes to — Your pool · {date}", "A collaboration — Not yet". Then: "She'll be waiting under 'Agreed, needs a set' on your Campaigns tab. Build a set for {date} when you're ready and she'll get an invitation with these terms filled in. She signs the agreement then."

### 6.6 Rejecting (T8)

"Reject this pitch?" · optional "Tell her why" with "She sees this." · the cooldown box: "{Name} won't be able to pitch you again until {date}. You can still invite her from Creators at any time." · the line "If you'd rather never hear from her, block her in Pitch settings instead." · Keep · Reject.

### 6.7 The thread (T9, T10)

Item 6's screen exactly: the round pill, turn cards with old beside new, her pitch as the opening turn shown as plain values, the state box, and the last-round warning before the final counter.

### 6.8 The pool (T11)

Item 6's screen, with pitch entries mixed in: a **PITCH** tag and "{Name} came to you on {date}". An entry that can't be used sits under **Not available** with a grey chip and no reason.

### 6.9 Her side (T12, T13, T14)

- **T12:** item 5's invitation with a green line — "The ₹{n} you agreed on {date}, in a set for {date}."
- **T13:** Waiting for a reply (with "They have until {date} · {n} days left"), Agreed (with "They'll send an invitation when they build a set for {date}"), Rejected (the reason in quotes and "You can pitch {brand} again after {date}").
- **T14:** no reply · withdrawn · the date passed · the limit reached · empty, each a plain sentence.

---

## 7. Validation and messages (server and app, identical text)

| Field / action | Rule | Message |
|---|---|---|
| Aim not accepted | Server | {Brand} aren't taking that kind of pitch. |
| Brand not accepting | Server | {Brand} aren't taking pitches right now. |
| She doesn't match | Server | You don't meet what {brand} are looking for. |
| Blocked | Server | You can't pitch {brand}. |
| In cooldown | Server | You can pitch {brand} again after {date}. |
| Second open pitch, same Aim | Server | You already have an open {Aim} pitch with {brand}. |
| Four open pitches | Server | You have 3 open pitches with {brand}, which is the most allowed. |
| Commission / fee / deliverables | Item 5's rules | (item 5's messages, unchanged) |
| Date too soon | Required ≥ 7 days ahead | Choose a date at least seven days from today. |
| Message | Required, ≤ 500 | Tell them why you'd be a good fit. |
| Answering after the deadline | Server | This pitch closed on {date}. |
| Accepting twice | Server | You've already answered this pitch. |
| Withdrawing after agreement is signed | Server | This has already been signed. |
| Reject reason | ≤ 200 | Keep it under 200 characters. |

---

## 8. Look and feel

Item 2's theme, as items 3–7 use it:

- White background, `#F6F6F3` surfaces, `#E5E4DE` borders, ink `#1A1A17` / `#5B5A53` / `#77766E`.
- Yellow `#FFC700` for the single main button; red only for Reject, Decline and Withdraw.
- Chips: Accepting / Agreed = active green; Your move = yourMove amber; Sent / Waiting = waiting blue; Rejected / You don't match = declined red; Not accepting / Paused / closed = ended grey.
- The cooldown box is the ended-grey family, never red — it is a pause, not a refusal.
- The provenance tag on a pool row is the completed-purple family, mono, uppercase.
- Her three numbers are the item 3 stat tiles.
- Plus Jakarta Sans; dates "28 Oct 2026" in summaries and "28 Oct" in lists; money "₹12,000"; percentages "14%".

---

## 9. Phase 1 checklist

### 9.1 Database
- Every column of the current pitch tables and `collab_agreements`, with writer and reader.
- Everything in §4 (D1–D11) mapped to a column or named as missing.
- `brand_creator_pool` as item 6 built it.
- `platform_settings` and its audit.
- Production counts from §3's last row.
- Indexes for her list, the brand's list, the limits and the job.

### 9.2 Backend
- Every endpoint in §5, with what exists today, its shape, its callers and its access checks.
- The brand-side eligibility service (can this creator pitch this brand) in full.
- The existing pitch negotiation machinery in full, and what retiring it affects.
- The brief path (`invite` with `agreement_id`) and every caller.
- Item 6's negotiation engine, and exactly what generalising it would touch.
- The jobs runner, and where the reminder and expiry work fits.
- The notification service and the keys that exist.

### 9.3 Phone apps
- **Creator:** item 3's brand list and the Pitches tab as they stand; where the pitch action attaches.
- **Brand:** the Creators tab's Pitches segment as item 3 left it.
- Components reusable from items 2–7: brand and creator cards, stat tiles, option boxes, the deliverables editor, the date field, turn cards, round pill, state boxes, sheets, skeletons, empty and error states.
- What is new: the pitch form, the pitch card, the cooldown box, the provenance tag.
- Any new native module.

### 9.4 Websites and admin
- Anything that touches pitches today; the two new numbers on item 6's settings page.

### 9.5 Tests
- Baseline pass and fail counts; existing tests touching pitches, `collab_agreements`, the brief path and pitch negotiation.

---

## 10. Phase 1 output

Write **`Docs/ITEM8_PITCH_GAP_REPORT.md`**:

1. **Summary:** area · status · one-line gap.
2. **Requirement table:** ID · requirement · status · evidence (`file:line`) · proposed change · risk.
3. **What already exists, in detail:** the pitch tables, `collab_agreements`, pitch negotiation, the brief path — and which parts item 8 keeps, rewires or retires.
4. **Link readiness (§3),** row by row.
5. **The one-engine question:** exactly what it takes for item 6's thread to attach to a pitch, what it touches, and your recommendation with the cost of each option.
6. **The retirement plan:** what happens to `collab_agreements`, the old pitch negotiation and the brief path, in what order, and what breaks.
7. **Proposed migrations** (additive), with dry-run checks.
8. **Proposed endpoints** with shapes, error codes and affected callers.
9. **The limits and the cooldown:** how each is enforced in one cheap query.
10. **Frontend plan** per screen, components reused and new.
11. **Test baseline** and the tests you will add.
12. **Questions for the founder,** each with a recommendation, including every assumption in §11.

Then **stop and wait for approval.**

---

## 11. Assumptions to confirm in your questions

1. **Accepting a pitch creates a pool entry and nothing else** — no set, no invitation, no contract, no money.
2. **There is no separate route into a collaboration for a pitch**; the brief path is retired.
3. **Pitch negotiation is item 6's engine**, with the pitch as the subject and her pitch as turn zero.
4. **The terms and their limits are item 5's**, validated by the same code.
5. **The response period is stamped at send** and the cooldown at rejection, so later admin changes move nothing in flight.
6. **A pitch closes early** when her proposed posting date comes within seven days.
7. **The cooldown is per brand, not per Aim**, and blocks only her pitching.
8. **A brand may always invite a creator it has rejected**, and she may always accept.
9. **One open pitch per brand per Aim, three open per brand**, no limit across brands.
10. **Her §8A settings are not applied against her** for a set matching what she pitched; paused and blocked always apply.
11. **She may withdraw at any time** before the agreement is signed, and after acceptance that means leaving the pool.
12. **Nothing in item 8 moves money.**

---

## 12. After approval (not in Phase 1)

- **Phase 2:** migrations, the pitch and its validation against item 2's settings, the limits, the send path, the brand's three answers, the pool entry, the thread generalisation, the cooldown, the job, the two admin numbers, notifications, and the retirement of the old machinery.
- **Phase 3:** the Creator screens T1–T4, T10, T12–T14; the Brand screens T5–T9, T11.
- **Phase 4:** tests — and then **the full end-to-end test pack across items 2–8**, which is the next piece of work after this item.

### 12.1 Final functionality: all must pass

1. A brand not accepting pitches, or whose settings she fails, shows the right chip and cannot be pitched — from the app and from the API.
2. The pitch form offers only the Aims and modes that brand accepts; sending another Aim is refused with the exact message.
3. A creator the brand has worked with before may pitch despite failing a soft condition, but never when paused or blocked.
4. Pay for Sale, Pay for Content and Hybrid pitches each carry exactly their own fields and nothing else.
5. Every numeric limit matches item 5's, with the same messages, because it is the same validator.
6. A posting date less than seven days ahead is refused.
7. A second open pitch of the same Aim to the same brand is refused; a different Aim is allowed.
8. A fourth open pitch to one brand is refused; pitches to other brands are unaffected.
9. `response_due_at` is stamped at send; changing the admin number afterwards does not move it, and does apply to the next pitch.
10. Reminders reach the brand once at 7 days and once at 21.
11. A pitch expires at its deadline, she is told, and she can pitch that brand again the same day.
12. A pitch closes early when her proposed date comes within seven days, with the exact sentence.
13. She can withdraw at any point before signing, with no cooldown.
14. The brand counters: item 6's thread opens with her pitch as turn zero, the round limit is stamped, and the old pitch negotiation is not used.
15. The round limit is enforced identically to an invitation, and the last round is announced on both sides.
16. **Accepting creates a pool entry and nothing else** — no campaign, set, invitation, contract or money, proved by checking each.
17. The pool entry carries the Aim, the agreed terms, her date and mode, and provenance showing the pitch.
18. The pool screen shows pitch entries beside move requests, with the provenance tag.
19. Creating a set from a pitch entry pre-fills the Aim, date and mode, and item 5's terms screen pre-fills the agreed money.
20. She receives an ordinary invitation with the green line, and can accept, counter or decline it.
21. For a matching set her own Aim, mode, city, category and minimum settings do not block her; for a differing set they do.
22. A creator who has since paused, or blocked the brand, can never be invited, and the brand sees only "not available".
23. Rejecting stamps the cooldown, tells her the date, and shows the brand the date before it taps.
24. During the cooldown she cannot pitch that brand with **any** Aim, and the API refuses it.
25. During the cooldown the brand can still invite her from Discover, and she can accept.
26. Blocking still works independently of any cooldown.
27. Withdrawn, expired and date-closed pitches start no cooldown.
28. The brief path no longer creates invitations, or is switched off, and it is stated which.
29. Another brand's or another creator's pitch, thread or pool entry returns 404.
30. No creator response contains the brand's notes, budgets, other pitches, or the reason she failed a setting.
31. Loading, empty and couldn't-load states appear on the brand list, both pitch lists and the thread.
32. Backend tests show no new failures against the Phase 1 baseline.

### 12.2 Final deliverable

A short summary of what changed, the test results, the result of every check 1–32, what was retired and what replaced it, and anything left open before the end-to-end test pack.
