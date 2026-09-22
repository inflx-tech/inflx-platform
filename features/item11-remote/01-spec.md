# item11-remote — spec

Rules doc **v1.27** §11.2 (with §2B, §2C, §7A, §7B, §9, §10, §11, §11.1, §12, §13, §17, §20,
§24, §25, §26, §27, §28, §31, §32). Locked mockups
`04-preview/mockups/item11-remote-locked.html` (R1–R18 plus the rules table, byte-identical to
the file locked with the approval). Gap report `Docs/ITEM11_REMOTE_GAP_REPORT.md`, approved with
ten answers and nine corrections in `PROMPT.md`; the Phase 1 brief is `GAP_CHECK_PROMPT.md`.

v1.27 changed nothing of v1.26. It writes the answers to Q1, Q3, Q4 and Q5 and the two money
rules (§2.2, §2.3 of the approval) into §11.2 as prose.

**Builds on** `features/item10-store-visit` — the same gate, the same mode source, the same
table, the same Delayed flag, the same job shape, the same copy module, the same components.
**Supersedes the shipment half** of `features/stage-4-the-shoot` (migration 161 and
`parcel.service`) — kept and extended, not replaced — and retires the hand-typed courier flow
that shipped with migration 024.

## What item 11 delivers

A creator **sends her delivery address**; the brand **picks products from her selling scope, marks
each Return or Gift and books one parcel** through INFLX; the parcel is **tracked to her door**;
she **checks each item and marks the shoot done**; and the **Return items come back from her door
at the brand's cost**. A **simulated courier** stands behind INFLX's own shipping layer until the
Shiprocket account is live.

It is the first item that moves physical goods, the first to hold a creator's street address, the
first to speak to an outside logistics provider, and the first money movement since item 9 that is
not a collaboration payment. **Item 16 reuses the shipping layer.**

## The four findings that earned the approval

1. **`addParcelItems` has never been able to work.** `getContractParties` never selects `b.id`,
   so `contract.brand_id` is `undefined` and the catalogue lookup matches nothing. Every call
   answers "Some of those products are not in your catalogue."
2. **Three live endpoints can leak a creator's address the moment one exists.**
   `getProduction` returns the whole `production_events` row to either party;
   `listCampaignProduction` treats the gate as a column rather than a filter and emits
   `shipment_to_*`; `influencer.controller.js:1531` returns `ci.delivery_address`.
3. **The Delayed CHECK would have thrown on the first Remote stage.** `ci_delayed_stage_known`
   lists five visit/content values and none of the five Remote ones.
4. **Every brand wallet in production is ₹0.00.** Nothing could have been booked on the first
   day of testing.

## The rules, as built

### The gate and the mode (§10, §11.2)
- `shootGate.assertShootOpen` unchanged — mode-agnostic, Pay for Sale on signatures alone, Pay
  for Content and Hybrid funded with tranche 1 released. On **every** Remote path and both jobs.
- The mode comes from `campaign_sets.shoot_mode` and never changes. A Store Visit collaboration
  on a Remote action is refused with `WRONG_MODE_VISIT`; a Remote one on an item 10 action keeps
  item 10's `WRONG_MODE`.
- `/initialise`'s mode picker and `flip-to-remote` stay retired.

### Her address (§11.2, §2B, §28)
- The four-part address, name, number, optional note ≤ 200 and sizes ≤ 100. State and city are
  references pre-filled from her profile; street and pincode typed.
- Checked against the courier network at send. No delivery → cannot send. No return pickup →
  can send, and the brand is warned before marking any line Return.
- **Locks when sent.** One correction, only after a back-to-store. Her profile changing later
  changes nothing.
- Only the owning brand sees it, only after `address_sent_at`. She never sees a branch street
  address.

### The products (§7A, §13, §20)
- Pay for Sale and Hybrid: her selling scope. Pay for Content: the whole published catalogue.
  **A sale collaboration with no scope receives nothing** — `SCOPE_NOT_SET`, never the catalogue
  (v1.27, Q3).
- Available only: `is_active AND pushed_to_store`. **No stock moves.**
- A product with active variants is sent in a chosen one; one without is sent as itself
  (v1.27, Q2). ≥ 1 line, ≤ 20 lines, ≤ 5 per `(product, variant)`.
- Each line Return or Gift. Freely editable until booked.

### Booking and money (§9, §11.2, §17)
- Pickup branch (main by default); box preset or dimensions; packed weight. GST-included price.
- Booking debits the outbound price and locks the quoted return price from available balance;
  short → refused with the shortfall as one total. Booking locks the list and produces the label.
- **The lock falls back to the outbound price** when the provider gives no return quote
  (v1.27, §2.3).
- **Cancel before collection is unlimited** and reopens the list. "Book again once" applies only
  after a back-to-store (v1.27, Q5).
- A **rebook** sends the same locked lines, charges a new outbound price, keeps the existing
  return lock, re-checks coverage, and clears any earlier check (§2.4).
- **A return that costs more than its lock** charges the difference, or records it as owed. Her
  pickup is never refused or delayed (v1.27, §2.2).
- **Owed never blocks anything.** Taken oldest-first from every credit that reaches
  `brands.wallet_balance` (v1.27, Q4).
- Never the creator's. Never `contracts.locked_amount`.

### Delivery, checking, shoot done (§11.2, §26, §25)
- Tracking from the provider through one webhook: collected, out for delivery, attempt failed,
  delivered, returned to store, weight charge.
- She marks each line received / missing / damaged, note ≤ 300. A difference never stops her;
  the brand is told, Admin sees it, the brand may report it (item 18 handles disputes).
- She marks the shoot done. The brand does not confirm. It opens the content step and moves no
  money.

### Returns (§11.2, §25)
- Due within the **stamped** Remote return window (`contracts.terms_json.returnTerms.days`) from
  the later of the posting date and shoot done, India time.
- She books the pickup from shoot done, choosing a day from tomorrow. All Return lines she marked
  received go. The actual price comes from the lock; the rest is released.
- **Where couriers cannot collect**, she sends it back herself at the brand's cost, settled
  outside INFLX, and marks **"I've sent it back"** — which stamps the auto-confirm clock
  (v1.27, Q1).
- The brand confirms each line, or it confirms itself after `remote_return_autoconfirm_days`,
  stamped at delivery to the branch (or at her mark), unless the brand has reported.
- Overdue is derived. Nothing moves on its own.
- Return → Gift until the pickup is booked; never Gift → Return.

### Delayed, Needs You, reminders (§11.2, §24, §25)
- Item 10's flag, five Remote stages: `address_not_sent`, `not_booked`, `in_transit`,
  `not_checked`, `shoot_not_marked`. **The return lane never delays anything.**
- Needs You: creator — send address, check, mark done, book the return; brand — pick and book,
  confirm the return. One rule, both sides.
- Reminded at 48 hours through item 10's `:55` lane; the **overdue return is the one exemption**
  from the posting-date stop (§11.2).

### The shipping layer
- `backend/src/services/shipping/` — one interface, `provider()`, a **simulator** (live), a
  **Shiprocket adapter** (written, switched off twice), one **webhook** shared by both.
- Events idempotent (`dedupe_key`), order-tolerant (monotonic `COALESCE … WHERE col IS NULL`),
  authenticated, raw payload always logged.
- **Zero imports** from `production*`, `contracts`, `campaign_*` — enforced by a test, so item 16
  can use it for a customer order.
- A shipment's `provider` is written once and never updated. A simulated shipment can never reach
  Shiprocket and vice versa.

### Admin
- `remote_return_autoconfirm_days`, default 7, 1–30, on the existing data-driven settings page
  (R17 needs no code). The existing Remote return window is unchanged.
- **Test parcels** (R18) — admin only, behind a new `shipping` capability, every press logged.

## Out of scope
Store Visit (item 10) · content (item 12) · disputes (item 18 — item 11 **records** a report) ·
customer orders (item 16 — the layer is built so item 16 can use it) · shared or relayed parcels ·
a second outbound parcel · cash on delivery · same-city riders · the brand choosing a courier ·
international · going live on Shiprocket · the delivery challan (Q6) · GST invoicing of courier
charges (Q7) · the nightly aggregator reconciliation (Q8).
