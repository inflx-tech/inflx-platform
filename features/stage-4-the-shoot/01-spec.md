# Stage 4 — The shoot

**Contract:** `features/stage-4-the-shoot/`
**Plan:** `Docs/THE_PLAN.md`, Stage 4 of 11. Stages 0–3 shipped.
**Drawn from:** `features/brand-mobile-spine/04-preview/mockups/final-3-delivery.html` (FINAL 3,
panels ② and ③) and `features/collab-navigation-spine/03-action-ledger.html` actions **107–118**.
**Written:** 2026-08-27, before any code.

---

## 1. What both sides will be able to do afterwards

**Settle a time, send the goods, and confirm what arrived — without leaving the app.**

Today the shoot is a panel buried inside the contract page, on both phones. It has no screen
of its own, so a notification about it has nowhere to point, and Stage 3's step 3 currently
says *"gets its own screen in Stage 4"* rather than opening anything.

And the new part: **what is actually in the parcel.** You list the three sarees. She confirms
them one at a time and flags anything missing. **A shortfall never becomes her problem** —
she shoots what arrived, and you decide whether to resend or drop it.

---

## 2. Reality check — read from the code and from production, 2026-08-27

### 2.1 Almost all of the coordination already exists

| Item | Verdict | Evidence |
|---|---|---|
| A shoot plan is created the moment both sides sign | **EXISTS** | `production.service.autoCreateForContract` |
| Propose a slot | **EXISTS** | `POST /production-events/:id/propose-slot` |
| Accept a slot | **EXISTS** | `.../accept` — either side |
| Counter-propose | **EXISTS** | `.../counter-propose` — either side |
| Flip a store visit to remote | **EXISTS** | `.../flip-to-remote`, with a request/confirm pair in the service |
| Dispatch a shipment | **EXISTS** | `.../dispatch` — courier, AWB, expected date |
| Confirm receipt | **PART** | `.../confirm-received` — see §2.3, it is all-or-nothing |
| Mark the visit done | **EXISTS** | `.../complete` |
| **The legal date window** | **EXISTS, and it is real** | `getVisitDateRange` — post-by **minus 2 days**, else the posting window minus 3, else the campaign end minus 3. Earliest is tomorrow |
| **Two reschedules per side, then locked** | **EXISTS** | `RESCHEDULE_LIMIT_PER_SIDE`, counted separately for brand and creator |
| **Every action is written down** | **EXISTS** | `production_event_log` + `logAction` on every mutation. **The shoot is the only step in the whole spine that does this** |

**Eight live endpoints.** The board's claim that this is "almost all a rendering job" holds
up.

### 2.2 …and none of it has a screen

| Item | Verdict | Evidence |
|---|---|---|
| A production route in the **brand** navigator | **MISSING** | grep for `production` across `navigation/*.js`: **zero hits** |
| A production route in the **creator** navigator | **MISSING** | same |
| Where the shoot lives today — brand | a panel inside the contract | `BrandContractScreen.js:628` *"Production coordination panel"* |
| Where the shoot lives today — creator | a panel inside the contract | `ContractScreen.js:366` *"Production Arrangement"* |
| A **Shoots** list across every creator | **MISSING** | nothing renders one, on either side |
| The shoot's action log | **NEVER RENDERED** | `getLog` exists and nothing calls it |

So: a notification saying *"Asha suggested Tuesday"* can only point at a contract page and
hope she scrolls.

### 2.3 The parcel has no contents — and receiving it ends the shoot

**Two findings, and the second was not in the board.**

**One.** `production_events` carries `shipment_courier`, `shipment_awb` and four timestamps.
Searched the whole schema and `backend/src` for a parcel, shipment items, or anything like
them: **nothing.** A shipment knows it was sent and when it landed, and has **no idea what is
inside it**. That is the genuinely new work in this stage.

**Two, and it needs a decision.** `confirmReceived` does three things at once: stamps the
receipt, and sets the event to **`completed`**. So today, **the box landing IS the shoot
finishing.**

That is wrong under the board's model. She receives a parcel, and *then* she shoots. Confirming
a delivery is not confirming a shoot. See §5.1.

### 2.4 What Stage 1 and Stage 2 already handed over

| Item | Verdict |
|---|---|
| Working style as **two questions** — where she shoots, and are you sending products | **DONE in Stage 1** (`features/collab-working-style-two-questions`). Not re-opened here |
| The style comes from the **agreement**, not from contract approval | **DONE in Stage 1** |
| A shared **product picker** — grouped, images, search, select-all | **DONE in Stage 2** (`components/brand/ProductPicker`). The parcel builder is its fourth caller, exactly as ledger #86 said |
| A per-creator **six-step spine** with step 3 reserved for this | **DONE in Stage 3** |

### 2.5 What is actually out there

Production, read-only:

```
4 shoots · 1 shipment (confirmed, Delhivery) · 3 visits (all completed)
log entries: 0
contracts: 4 active, 1 pending_brand
```

**Two things to know before the walk.** No visit carries a scheduled slot, and the log is
empty — because the practice world was **seeded straight into its end state** rather than
driven through the endpoints. The machinery has therefore never actually been exercised by a
person. Stage 4's walk will be the first time.

---

## 3. What changes

1. **The shoot becomes its own destination on both phones** — a real route, so step 3 of the
   spine opens it and a notification has somewhere to point.
2. **A brand sees every shoot in one list**, across campaigns, with what needs them first.
3. **Settling a time happens on a screen** — her suggestion, the legal window explained, accept
   or counter, with the reschedules left visibly counted.
4. **The parcel gets contents.** Picked from the catalogue, never typed — so what she confirms
   and what she can tag in a post are the same things.
5. **She confirms item by item**, and flags anything missing. The brand is told immediately,
   with the item named.
6. **A shortfall is the brand's problem, not hers.** Resend, or drop it — either way her shoot
   goes ahead.
7. **The shoot's diary becomes visible** — it has been recorded all along and never shown.

---

## 4. What we are NOT doing

| Not this | Why |
|---|---|
| Telling her what to shoot | Her craft, and the founder's own rule. The screen states the aim and the scope, never a shot list |
| Re-opening working style | Stage 1 settled it as two questions |
| Goods travelling creator to creator | `Docs/THE_PLAN.md` leaves this out deliberately — four commercial questions with money attached, and they are the founder's to answer, not design |
| Courier tracking integration | The AWB is recorded and shown. Live tracking is a different piece of work |
| The content that comes after | Stage 5 |
| Brand web | Phones first |

---

## 5. Decisions this stage has to make, and my answer

### 5.1 Does receiving the parcel finish the shoot?

**Today it does** (§2.3) and it should not.

**My answer: split them.** Confirming receipt moves the shoot to `in_progress`, not
`completed`. It finishes when **she says the shoot is done** — which is what `complete`
already exists for, and what the visit path already does.

**Why it matters beyond tidiness.** Step 3 of the spine is "the shoot". If receipt completes
it, her collaboration jumps to step 4 the moment a courier hands over a box — before she has
photographed anything. Both phones would then show step 4 while nothing has been shot.

**The cost, stated:** one live shipment (Asha's) is already `confirmed`, so it has not gone
through this path yet and nothing in production moves. But the change alters an endpoint's
end state, so anything reading `completed` on a shipment has to be checked. That is the one
piece of §2.1 this stage disturbs.

### 5.2 Where do parcel contents live?

A new table, `production_event_items`, one row per item: which product, how many, and what
she said about it — received, missing, or damaged.

**Not a JSON column on the event.** She answers per item and the brand resends per item, so
each one has its own small history. A JSON blob would make "she flagged the Indigo saree" a
string-edit rather than a row.

**And a resend is a second parcel, not an edit.** The board says so, and it is right: a
replacement has its own courier, its own AWB and its own delivery. Overwriting the first
would erase the fact that something went wrong.

### 5.3 Does a missing item change what she may sell?

The board's brand screen offers **"Drop it — she'll shoot the other two"** and says dropping
*"removes that saree from what she can sell"*.

**My answer: yes, but only on a hand-picked allocation.** If she was allocated the whole store
or a category, the item is still in scope and removing it would be inventing a hole in a rule
Part 4 defined as resolved live. On a hand-picked list, dropping it removes that id.

**Flagged rather than assumed** — it is the one place the board's wording implies a change to
allocation, which is another stage's machinery.

---

## 6. Open question for the founder

**One, and it is commercial rather than design.**

The board's creator screen has **"Mark one damaged"** beside the missing flag. Missing and
damaged are different problems: a missing item never arrived, a damaged one did and is
unusable.

The platform has no notion of who bears a damaged item. Today the honest options are to record
it and tell the brand — the same as missing — or to leave the word out until there is a rule
behind it.

**My recommendation: record it, and treat it exactly like missing** — she shoots what she can,
the brand decides to resend or drop. That is true, useful, and invents no liability rule. If
you want damaged handled differently from missing, that is a decision I should not make.
