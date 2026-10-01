# item10-store-visit — spec

Rules doc **v1.24** §11.1 (with §10, §9, §12, §19, §21, §23, §24, §25, §28, §31). Locked mockups
`04-preview/mockups/item10-store-visit-locked.html` (V1–V15 plus the rules table, byte-identical to
the file locked on 18 Sep). Gap report `Docs/ITEM10_STOREVISIT_GAP_REPORT.md`, approved with
fourteen answers and five further decisions in `PROMPT.md`; the Phase 1 brief is `GAP_CHECK_PROMPT.md`.

**Supersedes** four earlier shoot contracts that were approved and never released:
`features/stage-4-the-shoot`, `features/shoot-starts-where-the-agreement-left-it`,
`features/shoot-plan-you-can-actually-see`, `features/post-agreement-shoot-and-content`. Their
migrations (024, 039, 161, 164) and the parts of their code this item keeps are listed in the gap
report §4.2. Their mobile screens were deleted on 10 Sep (`5e04e1c`); the orphaned parts this item
reuses are `components/shoot/ShootParts.js`, `DateTimeChipPicker.js`.

## What item 10 delivers

A brand **plans a store visit** — a time, a person to ask for, and the street address the creator
has never seen; she **accepts it or asks for another time** through item 6's engine; she **marks
that she attended** and the brand confirms, or it confirms itself. Its first job is the **funding
gate** §10 has always described and nothing enforced: signed by both, and for Pay for Content and
Hybrid funded, locked and the first 25% out — on every path into the shoot.

## The rules, as built

### The gate (§10, §11.1)
- One function, `shootGate(ciId)`, beside `SIGNED_CONTRACT_SQL`. Pay for Sale opens on the two
  signatures; Pay for Content and Hybrid also need `contracts.money_at`, `locked_amount > 0`,
  three escrow rows and tranche 1 `released`. A legacy zero-fee paid collaboration is **blocked**
  (Q4). `contracts.status = 'active'` is never a signature test anywhere.
- One guard, `assertShootOpen`, on every surviving path: the contract reads, the date range, the
  brand list (as a filter), the roster, the admin queue (as a column), every event-scoped route,
  every item 10 endpoint, both jobs, the reminder lane, and `autoCreateForContract` itself.

### The mode (§11)
- `campaign_sets.shoot_mode` is the source of the shoot's mode; the agreement second; `'remote'`
  last. The brand never chooses a mode inside the shoot (`/initialise`'s picker and
  `flip-to-remote` retired server-side). Six production rows born wrong are corrected once,
  behind `--fix-modes`, after the resolver change (Q2).

### The plan
- One shoot row per collaboration (`production_events.contract_id UNIQUE`). The branch is
  inherited from the set and its address is **snapshotted at send** into `visit_address` etc.
  Contact person and number are required (Indian mobile; prefilled with the brand's login
  number, editable — Q11). Duration and notes (≤ 500) optional. **One call sends it** (Q5).
- The street address and the contact number reach the creator **only when `plan_sent_at` is
  set** — before that she sees the branch's city, as the agreement gives it.
- A Store Visit set cannot be created or updated with a branch that has no street address, and a
  plan cannot be sent to one; both messages name the branch (Q6). A collaboration with no posting
  date cannot take a plan (`NO_POSTING_DATE`, Q14).

### The time (§11.1, §25)
- `> now` and `<= endOfIndiaDay(go_live_date)`, on the range endpoint and on every write. No
  minimum notice (Q10). Judged in India.
- **Negotiable through item 6's engine** as a third anchor (`negotiations.production_event_id`):
  the plan is turn zero, the round limit is the one stamped when the thread is born, there is **no
  decline**. The campaign's negotiation switch does not apply (§2.4 of the approval).
- **Either side may move an agreed time** before it is confirmed; the **same thread reopens**
  (`outcome` cleared, counters counted since the last `accept` turn, the stamped limit never
  re-read — Q7). A move after she marked attended clears her mark, the due date and the stamped
  days, logged as `attended_cleared`; after confirmation it is refused with `SHOOT_COMPLETE` (Q3).
- A passed time is derived, records nothing against anyone, and the brand sends a new time.

### Marking it done (§11.1, §25)
- She marks attended **any time once the time is agreed** (founder, 1 Oct 2026 — "let them have
  shoot in their respective timing"; this retires Q9's "from 00:00 IST on the agreed day"). What
  opens the next step is the confirmation, never her mark and never the calendar.
- **Only the brand confirms a store visit** (founder, 1 Oct 2026 — "dont let next step open unless
  brand confirm the shoot is done"). The three-day auto-confirm, its hourly job and the admin
  number `shoot_auto_confirm_days` are retired; nothing is stamped when she marks. While a marked
  visit is unconfirmed the brand's row chips Your move, the visit shows "Confirm the shoot is done"
  (or "She didn't come — send a new time"), and the brand is reminded every 48 hours, past the
  posting date too. Shoppable posts, the content step and Going live stay shut until he confirms.
  Nothing here locks, releases or refunds money.

### Delayed (§11.1, §25 v1.24)
- The day after the posting date, a job flags `campaign_influencers.delayed_at/_stage` when the
  shoot is not complete; both sides told once; **nothing else moves** — status, set, agreement,
  money all untouched (Q13). Item 12 sets the same flag for content.

### Reminders (§25, approval §2.5)
- One nudge to whoever's turn it is when a sent plan or a thread turn has sat 48 hours; not more
  than once per 48 hours; nothing after the posting date; nothing whose gate is closed. Pitch
  threads are **not** extended in this item — recorded as its own piece of work.

### Admin
- `shoot_auto_confirm_days` (3, 1–30) on the data-driven Platform Settings page; stamped, never
  read live. The production queue shows the 164 timestamps, the due date, the posting date, the
  Delayed flag and how many times a thread has reopened.

## Out of scope
Remote (item 11 — the handover notes in `05-impact.md` list what it inherits, including the
`addParcelItems` undefined-`brandId` defect); the content step and Hybrid's trigger (item 12); the
delayed-collaboration set (later); transport and travel; money.
