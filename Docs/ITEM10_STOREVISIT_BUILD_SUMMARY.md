# Item 10 — The Store Visit shoot plan: build summary

Built 18 September 2026 against rules **v1.24** §11.1, the locked mockups V1–V15 and the approved
gap report (`Docs/ITEM10_STOREVISIT_GAP_REPORT.md`, fourteen answers and five further decisions in
`features/item10-store-visit/PROMPT.md`). Contract: `features/item10-store-visit/`.

**Nothing has been deployed.** Migration 187 is not applied, nothing is pushed, no OTA is
published, and the six-row mode correction has only been dry-run. Nothing was created, sent,
confirmed, marked or cancelled in production, and no money moved. The go for all of that is yours.

One correction to the record, as asked: the gap-check prompt said the two named endpoints checked
"party membership and no status at all". That was true when item 7's survey was written and false
by the time item 10 started — item 7 (commit `5a8e9db`) added `assertBothSignatures` to both. What
was still true, and is now fixed, is that **the money half of the gate was checked nowhere**, and
that sixteen other paths did not check even the signatures.

---

## 1. The gate

**What it checks.** `shootGate(ciId)` — `backend/src/services/shootGate.service.js` — answers one
question: may this collaboration reach the shoot? Signed by both (item 7's two timestamps, never
`contracts.status`) and, for Pay for Content and Hybrid, `contracts.money_at` stamped,
`locked_amount > 0`, three escrow rows, tranche 1 `released`. Pay for Sale opens on the signatures
alone (`money.required = false`). A paid collaboration with nothing locked is **blocked** whatever
its age (Q4). `assertShootOpen(contractId)` refuses with `NOT_SIGNED` "This collaboration isn't
signed by both of you yet." or `NOT_FUNDED` "The money for this collaboration isn't locked yet."

**Where it is called.** Every path in the table below, every item 10 endpoint (F1–F8), the three
jobs (a closed gate is skipped, never confirmed or flagged), and `autoCreateForContract` itself — so
no future door can create an ungated shoot row (check 33). The shoot row is now born **after** the
money inside the countersign transaction, in a savepoint, so a fault there can never take the
signature down with it.

**The route table — eighteen paths, before and after.**

| # | Path | Before | After |
|---|---|---|---|
| 1 | `GET /contracts/:id/production` (+ auto-heal) | party + signatures | party + **gate** |
| 2 | `POST /contracts/:id/production/initialise` | party + signatures | party + gate, then **retired** (`RETIRED_MODE_CHOICE`) |
| 3 | `GET /contracts/:id/production/date-range` | party only | party + **gate**; range is today → posting day inclusive |
| 4 | `POST /contracts/:id/production/visit-details` | party only | party + gate, then **retired** (`RETIRED_SLOT_DANCE`) |
| 5 | `POST /production-events/:id/propose-slot` | party only | **gate** (via `getEventOrThrow`), then retired |
| 6 | `POST /production-events/:id/accept` | party only | **gate**; retired for a visit, kept for a shipment (item 11) |
| 7 | `POST /production-events/:id/counter-propose` | party only | **gate**; retired for a visit, kept for a shipment |
| 8 | `POST /production-events/:id/dispatch` | party only | **gate** (item 11's, otherwise untouched) |
| 9 | `POST /production-events/:id/confirm-received` | party only | **gate** |
| 10 | `POST /production-events/:id/complete` | party only | **gate** |
| 11 | `POST /production-events/:id/flip-to-remote` | party only | **gate**, then **retired** (`RETIRED_MODE_CHOICE`) |
| 12 | `POST /production-events/:id/cancel` (admin) | admin only | admin + **gate** |
| 13–16 | the parcel routes (`items`, `drop`) | party only | **gate** |
| 17 | `GET /brands/me/shoots` | none | **gate as a filter** + stage + Delayed |
| 18 | `GET /campaigns/:id/production` | `ci.status IN (…,'live',…)` — a value that does not exist | real statuses + **gate as a column** |
| 19 | countersign → `autoCreateForContract` | ran before the money | runs after the money, **asks the gate itself** |
| 20 | admin `/production/queue` | none | **gate as a column** + timestamps, posting date, Delayed, reopen count |
| 21 | brand-web `ProductionPanel` render | `contract.status === 'active'` (client) | the two signatures; visit branch and mode picker → read-only card |
| 22 | the apps | no screen | every screen behind F1–F8, which sit behind the gate |

Proved by a **loop over the route table** (`item10-storevisit.test.js`), not a test per route: a
signed-but-unfunded Pay for Content collaboration is refused on all 22 requests across those paths
with `NOT_FUNDED` and the exact sentence; an unsigned one with `NOT_SIGNED`; a Pay for Sale one
opens with `money.required = false`.

---

## 2. The mode defect

**The resolver.** `productionMode.model.resolveProductionMode({ setMode, contractMode, agreementMode })`
now reads `campaign_sets.shoot_mode` first, the contract second, the handshake agreement third,
`'remote'` last — and says which (`source`). `shoot-plan.test.js`'s 29 assertions, including the
agreement-fallback ones, stay green (check 36). A `visit` set now produces a `visit` shoot at
countersign and a `shipment` set a `shipment` shoot (check 35). The set's branch rides with the
row from birth; the address does not — it is snapshotted at send, which is when she may see it.

**Found on the way, and fixed:** the shipment prefill inside `autoCreateForContract` selected
`users.pincode`, which does not exist. It had never run — every shipment resolved to `remote` — and
the moment the mode was honoured it aborted the countersign transaction for five of seven
production collaborations. The column is no longer read (item 11 replaces the prefill), and the
savepoint above means a fault there can never do that again.

**Dry-run output, 18 September (read-only, nothing written):**

```
production_events                 : 11
  by mode / status                : remote/confirmed 6 · shipment/confirmed 1 · visit/completed 3 · visit/proposed 1
negotiations                      : 2   (2 with exactly one anchor — the new CHECK will accept them)
campaign_influencers              : 18
platform_settings keys            : 8
shoot rows disagreeing with set   : 6
already applied?                  : all four markers false

── Q2 data correction: production_events.mode ← campaign_sets.shoot_mode ──
  30f22d68…  remote → shipment   status confirmed  time —  Kanchi Silks (practice)  posts 2026-09-30
  32738ebd…  remote → shipment   status confirmed  time —  Kanchi Silks (practice)  posts 2026-09-30
  33d9f389…  remote → shipment   status confirmed  time —  Kanchi Silks (practice)  posts 2026-09-23
  63d9b70d…  remote → shipment   status confirmed  time —  Kanchi Silks (practice)  posts 2026-09-23
  79203cf3…  remote → shipment   status confirmed  time —  Kanchi Silks (practice)  posts 2026-09-30
  18cb7756…  remote → visit      status confirmed  time —  Kanchi Silks (practice)  posts 2026-09-26
untouched by this fix: status, every timestamp, escrow, wallets, contracts.
```

`--fix-modes --apply` is a separate step, after the code is deployed (Q2's condition), and it
refuses to run unless the row count matches what it printed. After it, the sixth row — the only
Store Visit collaboration — reads as a visit with no plan sent yet; the other five are Remote and
wait for item 11.

---

## 3. The engine — the third anchor

**Touched** (`negotiation.service.js`): `loadShootContext` (a third loader, `kind:'shoot'`,
rounds counted per episode from the last accept); `anchorOf`; `termsOf` / `normalizeSnapshot`
(one term, `{ visitAt }`, validated as a real instant, in the future, on or before the posting day
in India); **`canon`** — the change detector now serialises the instant, so two snapshots differing
only in time are different (check 38, tested on `canon` directly); `termsLine` / `changesBetween`
print "Sun 18 Oct, 11:00 am → Mon 19 Oct, 4:00 pm"; `assertOpenInvitation` (open until the shoot
is complete); `notify` (deep link); `counter` (either side may open; the plan is turn zero; the
campaign's negotiation switch is skipped for a shoot and the code says why — approval §2.4;
`reopen: true` for a move; `TIME_ALREADY_AGREED` for a plain counter on an agreed time);
`accept` (writes the time onto the row, `time_agreed_at`, `status='confirmed'`); `decline`
(`NO_DECLINE`, 422); `thread` (`can.decline` false, `can.move` true when agreed, `anchor`,
`shootId`, `visitAt`); `endingOf`; a new **`reopen()`** guarded by `production_event_id IS NOT NULL`;
`initiated_by` falls back to the acting side's user id. Migration 187 adds `production_event_id`,
its partial unique index, and rewrites `negotiations_one_anchor` as `num_nonnulls(...) = 1`.

**Reused untouched:** the turns table, `endThread`, `roundLimitOf` (the stamped limit always
wins), `WRONG_TURN`, `NO_ROUNDS_LEFT` (the shoot sentence), the reminders' columns, item 6's turn
cards, round pill, state boxes and change lines on the phone. Items 6 and 8: 122 tests unchanged.

---

## 4. What was retired, and what replaced it

| Retired | How | Replaced by |
|---|---|---|
| The slot dance — `visit-details`, `propose-slot`, the visit half of `accept` and `counter-propose` | 422 `RETIRED_SLOT_DANCE` "Visit times are agreed through the shoot plan now." | F2+F3 send, F4 accept, F5 thread, F6 move on item 6's engine |
| `flip-to-remote` | 422 `RETIRED_MODE_CHOICE` | nothing — §11: the mode never changes inside the shoot |
| `/initialise`'s mode picker | 422 `RETIRED_MODE_CHOICE` | the set's `shoot_mode`, read at countersign |
| brand-web's visit panel and its three-way initialise picker | read-only card: "The shoot plan is managed in the app…" | the phone screens |
| `getVisitDateRange`'s "posting date minus one day" | today → posting day inclusive, basis `posting_date` | the same rule on every write |

The shipment half of `accept` / `counter-propose`, `dispatch`, `confirm-received`, the parcel
routes and `production-shipment-reminder.job` are item 11's and were left as they were — behind
the gate.

---

## 5. The four small defects (approval §2)

| | Verdict |
|---|---|
| §2.1 deliverables invented for unsigned contracts | **Fixed.** `influencer.controller.js` heals deliverables only when both signature timestamps exist. Tested: a seeded `active`-with-no-signatures contract gets none; a signed one still does. |
| §2.2 `DangerButton` drops `busy` | **Fixed.** Same contract as `PrimaryButton`; two taps while busy make zero presses; `accessibilityState.disabled` is a real boolean (check 44, 3 mobile tests). |
| §2.3 `'live'` in the roster's status list | **Fixed.** The list is `contracted`, `active`, `completed` — the three statuses a signed collaboration passes through. |
| §2.4 the negotiation switch and the visit time | **Done.** `loadShootContext` forces `allow_negotiation` true and `counter()` skips the switch for a shoot, with a comment naming the decision (check 42). |
| §2.5 reminders | **Done.** `shoot-reminders.job` at `:55`: one nudge at 48 h to whoever's turn it is, not again within 48 h, nothing after the posting date, nothing whose gate is closed (check 47). Pitch threads are **not** extended — left open below. |

---

## 6. Every remaining `contracts.status = 'active'` read

| Where | Verdict |
|---|---|
| `contractSign.service.js:155` — `SET status = 'active', brand_signed_at = now() … WHERE status = 'pending_brand'` | The **only write**, and correct: the status and the signature move together in one compare-and-swap. |
| `agreement.service.js:372` — `if (ctx.brand_signed_at \|\| ctx.contract_status === 'active') throw ALREADY_SIGNED` | Belt-and-braces beside the timestamp; the timestamp carries it. Safe; left. |
| `influencer.controller.js` deliverable heal | **Was** a signature test; **now** the two timestamps (§2.1). |
| `production.controller.js` | Never read it; now carries a source-text test that it does not. |
| brand-web `influencers/page.js` render gate | **Was** `contract.status === 'active'`; **now** the two timestamps. |
| `campaign_influencers.status = 'active'` (many places) | A different column — "content is live". Not a signature test. |

Nothing in the codebase reads `contracts.status = 'active'` as a signature test (check 48).

---

## 7. Test results

**Backend:** baseline 1330 tests / 1109 passed / 221 failed (the pre-existing debt, none in item
10's ground). After item 10: **1384 tests / 1161 passed / 223 failed** — `compare.js
baseline_item10.json after-item10.json`: **54 new, all passing; 0 gone; 2 new failures, both
assertion drift and both updated on the spot** — `item6-negotiation` check 29 pinned the exact list
of admin settings (now nine, with `shoot_auto_confirm_days`), and `india-day` pinned the visit
window opening *tomorrow*, which item 10 changed to *today* (Q10, no minimum notice). Both suites
re-run green (65 / 65), so the effective count is **221 failed — the baseline's 221, none new**.
New: `item10-storevisit.test.js` (16), `item10-engine.test.js` (15), `item10-flow.test.js` (23) — 54.

**Mobile:** 575 / 575 (48 suites). New: `shoot10.test.js` (9 — imports, the Indian clock without
Intl, the gate card per Aim, the step line, the time card, the address card, the picker's cap and
steps, the copy) and `dangerButton.test.js` (3).

---

## 8. The result of every check, 1–48

| # | Check | Result |
|---|---|---|
| 1 | Signed-but-unfunded PfC cannot reach the shoot from any path, incl. the two that checked nothing | **Pass** — the loop; also `money_at` NULL and a short escrow set |
| 2 | Pay for Sale reaches the shoot on both signatures alone | **Pass** |
| 3 | An unsigned collaboration reaches the shoot from no path | **Pass** — every contract-scoped path 422 `NOT_SIGNED`; no row exists |
| 4 | Gate card shows real conditions per Aim | **Pass** — PfC three lines with 9,720 / 2,250; PfS the signature only |
| 5 | Plan inherits branch and mode; neither changeable by app or API | **Pass** — a body with `branchId` / `mode` changes nothing |
| 6 | Picker offers no date after the posting date; API refuses one | **Pass** — picker test + `TIME_AFTER_POSTING` |
| 7 | A time in the past is refused | **Pass** — `TIME_IN_PAST` |
| 8 | Sending reveals address and number; nothing before does | **Pass** — her F1 before/after; no leak string in the body |
| 9 | Editing a sent plan refused; a new time is the only route | **Pass** — `PLAN_ALREADY_SENT`; contact unchanged |
| 10 | She accepts; both sides see it agreed | **Pass** |
| 11 | She counters: item 6's thread with the plan as turn zero, admin limit, no decline | **Pass** |
| 12 | Round limit identical to invitation and pitch | **Pass** — stamped `negotiation_rounds`, `NO_ROUNDS_LEFT`, live change ignored |
| 13 | Either side reschedules; the same thread reopens | **Pass** — same `negotiations.id`, one row |
| 14 | A rescheduled time after the posting date is refused | **Pass** |
| 15 | Agreed time passes: nothing changes, no fault, brand can send a new time | **Pass** |
| 16 | She marks attended; due date stamped from the admin number, shown to both | **Pass** — `auto_confirm_days` 3, due = mark + 3 d |
| 17 | Brand confirms; shoot completes; content step opens | **Pass** — step line `done, done, now, later` |
| 18 | Brand does nothing: job confirms at the due date, records automatic, tells both | **Pass** — re-run no-op; closed gate skipped |
| 19 | Changing the admin number moves nothing stamped, applies to the next | **Pass** |
| 20 | Marking or confirming twice / two devices → exactly one | **Pass** — parallel requests 200 + 422 |
| 21 | **No money moves anywhere in item 10** | **Pass** — balances, escrow, both ledgers byte-equal before the plan and after auto-confirm (Hybrid) and after a brand confirm (PfC) |
| 22 | Delayed flagged the day after, with the right stage, both told once | **Pass** — four stages, a done and a future one untouched, a Remote one untouched |
| 23 | A delayed collaboration can still be planned, agreed, attended, confirmed | **Pass** (the posting date must first be moved forward — see §9) |
| 24 | A delayed collaboration stays in its set; item 4's counts and expiry unaffected | **Pass** — `set-expiry` keeps the set, `expired_at` null, status unchanged |
| 25 | Creator never sees the street address or the number before send | **Pass** |
| 26 | A Remote collaboration cannot use these endpoints, and says why | **Pass** — `WRONG_MODE` "This is a Remote collaboration. Products are shipped to Tanvi." |
| 27 | Another brand's or creator's shoot → 404 | **Pass** — five routes tried |
| 28 | Needs You shows the right move to the right side at each of the four points | **Pass** — brand tree and her flat count |
| 29 | Loading, empty, couldn't-load on both sides' shoot screens | **Pass** — `Skeleton`, `EmptyState`, `LoadError` on every new screen; imports proved |
| 30 | Backend tests show no new failures vs the baseline | **Pass** — two assertion-drift updates (an admin-settings key list; the window's first day), then 221 failed = the baseline's 221 |
| 31 | Every surviving path refuses signed-but-unfunded, by a loop | **Pass** |
| 32 | The loop refuses unsigned everywhere and opens PfS with `money.required=false` | **Pass** |
| 33 | `autoCreateForContract` refuses when the gate is closed | **Pass** — direct call rejects `NOT_SIGNED`; the auto-heal cannot sneak one in |
| 34 | Gate card numbers = `locked_amount` / `released_amount` | **Pass** |
| 35 | Visit set → visit shoot; shipment set → shipment shoot | **Pass** |
| 36 | `shoot-plan.test.js`'s 29 still green, agreement fallback intact | **Pass** |
| 37 | After `--fix-modes` all six match their set, no seventh, no timestamp or money moved | **Dry-run proved** (six rows, nothing else); the apply is on your go |
| 38 | A time-only counter is accepted, `canon` tested directly | **Pass** |
| 39 | Turn zero consumes no round; stamped limit; identical `NO_ROUNDS_LEFT` behaviour | **Pass** |
| 40 | No decline route (404) and `can.decline` false | **Pass** |
| 41 | After a reschedule: same id, outcome null, budget from the last accept | **Pass** |
| 42 | Switch off does not stop a visit-time counter | **Pass** |
| 43 | Move after she marked clears mark, due, days; logs `attended_cleared` with old values; reopens; notifies once; `SHOOT_COMPLETE` after confirmation | **Pass** |
| 44 | `DangerButton` honours `busy` on every sheet | **Pass** — the primitive itself, so every sheet inherits it |
| 45 | Visit set cannot be created/updated on an address-less branch; a plan cannot be sent to one; both name the branch | **Pass** |
| 46 | No posting date → `NO_POSTING_DATE` on send; F1 read-only, no crash | **Pass** |
| 47 | Nudged once at 48 h, not again within 48 h, nothing after the posting date, nothing with a closed gate | **Pass** |
| 48 | Nothing reads `contracts.status = 'active'` as a signature, incl. the deliverable heal | **Pass** — §6 above |

---

## 9. Left open — for you, for item 11, for item 12

**For you (three small things I did not decide):**

1. **V13's "Call {name}".** The mockup shows the brand a call link to the creator when a time
   passed. The server never sends her phone number to the brand — the gap-check's D9 says the brand
   sees nothing new about her in item 10 — so the button has nothing to dial and is not drawn. If
   you want it, say so and it is one field on F1 (brand side only, both signatures present).
2. **A delayed Store Visit needs its posting date moved before a new time can be sent.** The rule
   caps the visit at the posting day; once that day has passed, no day is offered — which is the
   rule, not a fault. Item 4 already lets the brand move a set's date while nobody new is invited.
   The Delayed screen's button works as soon as the date is moved. If you would rather the app say
   that sentence on V14, it is one line.
3. **The three practice branches still have no street address** — a Store Visit set cannot be
   created on them now, and the one live Store Visit collaboration (Kanchi Silks, posts 26 Sep)
   cannot send a plan until "Main Branch" has one. You said you would add them before the walk.

**For item 11 (Remote):** same table, gate, mode source, completion columns, Delayed flag and job
(extend the lane past `mode = 'visit'` and the stage vocabulary), notification namespace, Needs You
rule, F1 shape. `addParcelItems` passes `undefined` as `brandId` (`production.controller.js`
`getContractParties` never selects `b.id`) — item 11 starts with it. The `users.pincode` prefill is
gone; item 11 takes the address at the shoot plan per §11.2.

**For item 12 (content):** `production_events.status = 'completed'` with `brand_completed_at` or
`auto_confirmed_at` is "the shoot is done"; the step machine already advances on it. Item 12 sets
`campaign_influencers.delayed_stage = 'content_not_live'` on the same flag.

**Its own piece of work:** pitch threads get no 48-hour reminder (item 8's gap, unchanged here).

---

## 10. Deploy — waiting for your go

Production-impacting; no money moves at deploy. In order, each on your word:

1. `node scripts/run-187.js --apply` (dry-run above; additive; the negotiations CHECK is rewritten
   and both existing rows satisfy it).
2. `git push origin main` → Render (backend) and Vercel (brand-web's read-only card).
3. `node scripts/run-187.js --fix-modes --apply` — the six rows, after the resolver is live (Q2).
4. `pnpm publish-ota:brand`, then `pnpm publish-ota:influencer`.
5. Proof: `GET /v1/influencers/me/invitations/:ciId/shoot` answers 401 (route exists) while a
   made-up sibling answers 404; a read-only count that the escrow rows, ledger rows and balances
   are exactly what they were before.
