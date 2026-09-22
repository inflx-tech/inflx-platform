# Item 11 — The Remote shoot: build summary

Written in the order the approval asked for (§4.2).

**Nothing has been pushed. Migration 191 has not run against production. No Render environment
variable is set. No courier has been called. No money has moved.**

---

## 1. The four findings, and what each now does

**1 · `addParcelItems` has never been able to work.**
`getContractParties` joins `brands` to reach the business name and never projected `b.id`, so
`contract.brand_id` arrived `undefined`, the catalogue lookup matched nothing, and **every**
add-products call answered *"Some of those products are not in your catalogue."* It stayed
hidden because no parcel has ever been packed in production and, until item 10 fixed the mode
resolver on 18 Sep, no set-first collaboration was a shipment at all.
**Now:** one line added (`b.id AS brand_id`). A test puts a real product in a parcel, refuses
another brand with 403, and still refuses a product from someone else's catalogue — the fix did
not widen the check. *(check 40)*

**2 · Three live endpoints could leak a creator's address the moment one existed.**
`getProduction` returned the whole `production_events` row to either party; the campaign roster
emitted `shipment_to_*` with the gate as a *column* rather than a filter; and
`influencer.controller.js:1531` returned `ci.delivery_address`. A fourth path copied that legacy
column onto the shoot row **at the brand's signature**, before she had sent anything.
**Now:** one projection decides what leaves, and **it landed before any `ship_to_*` column
existed** — there was never a moment when her address sat on a row two endpoints spread. The
brand receives `ship_to_*` only after `address_sent_at`; the creator never receives a branch
street address or pincode. The prefill is deleted. *(checks 42, 43)*

**3 · The Delayed CHECK would have thrown on the first Remote stage.**
`ci_delayed_stage_known` listed five visit/content values and none of the five Remote ones, so
the job would have raised a constraint violation the first time it tried to flag a Remote
collaboration.
**Now:** widened in migration 191, and all five values are asserted against the live constraint.
*(check 30)*

**4 · Every brand wallet in production is ₹0.00.**
Not ours to fix, and unchanged: nothing in item 11 can be booked until a wallet has money. The
founder tops one up for the walkthrough.

---

## 2. Privacy: every endpoint that can return a creator's address

| Endpoint | Before | After |
|---|---|---|
| `GET /contracts/:id/production` | The **whole row**, to either party, no filter | Projected. `ship_to_*` only for the brand and only after `address_sent_at`; `visit_*` street address only for the brand or after `plan_sent_at`; the eleven legacy `shipment_*` columns removed from the projection entirely |
| `GET /campaigns/:id/production` | `shipment_to_address_line / _city / _pincode` plus hand-typed courier fields, with the gate as a **column** so every row came back regardless | Those six columns gone from the SELECT |
| `GET /influencers/me/campaigns/:ciId` | `ci.delivery_address` | Removed. A test writes a value into that column and asserts the string never appears in the payload |
| `production.service.autoCreateForContract` | Copied `delivery_address` + `users.city/state` onto the shoot row **at the brand's signature** | Deleted. She starts the Remote shoot; nothing guesses her address |
| `GET …/remote` (F1, new) | — | The single place her address reaches a brand, and only after she sends it |
| `ProductionSection.js` (brand website) | Read `ci.delivery_address` to draw the row | Reads the shoot's **mode** instead |

**The creator's side carries no money at all** — not the shipping cost, not the lock, not what
came back. A mobile test asserts the rupee figure is absent from her screen.

---

## 3. What was retired, in order, and what replaced each

| Retired | Why | Replaced by |
|---|---|---|
| `POST …/dispatch` | A typed courier name and a typed AWB are not a shipment | **F8** books one through the shipping layer, debits, locks the return, returns a label |
| `POST …/confirm-received` | "The box arrived" is not what §11.2 asks of her | **F12** takes her answer line by line, with a note |
| `POST …/complete` — **Remote only** | §2.9's caller audit found the brand website's **"Mark visit done"** live on the Store Visit path, so that branch is untouched | **F14**, which adds the rule this door never had: she must have checked what arrived first |
| `POST …/items/:itemId/drop` | It let the brand erase a line she had flagged, and carved products out of a hand-picked selling scope | Nothing. Item 11 records what she reports; the brand reports a difference to INFLX (F13) |
| `accept` / `counter-propose`, shipment half | There is nothing to agree on a Remote shoot | Nothing. Their visit half was already retired by item 10, and both website callers sit on that dead path |
| `production-shipment-reminder.job` **and its SMS** | It matched only the hand-typed dispatch, asked **no gate**, and sent the only SMS in the whole shoot | The `:55` lane, covering all six Remote moves at 48 hours, behind the gate, push and in-app only |
| Admin **Production Queue** page | Its middle bucket was fed by the retired dispatch and can never fill again | The Delayed flag, the reminder lane, and **Test parcels**. The endpoint stays mounted — item 10's tests read it |
| Brand website **shipment panel** | "Shipping to" printed a creator address; the button's endpoint was switched off; and booking needs a branch, box, weight, wallet and label | A read-only card: *"Parcels are managed in the app."* |

**Columns and data are left exactly as they are.** `flip-to-remote` and `/initialise` stay
refused, re-proved. *(check 60)*

---

## 4. The shipping layer

**The interface** — `checkCoverage`, `quote`, `registerPickup`, `book`, `cancel`, `bookReturn`,
`label`, plus one inbound webhook. Seven INFLX events: collected, out for delivery, attempt
failed, delivered, returned to store, weight charge, cancelled.

**The simulator, live today.** Pincodes ending `999` do not deliver; `998` deliver with no
return pickup. A believable price from weight, volumetric weight and the §2C city coordinates,
**GST inside the total**. Tracking numbers `TEST##########`; a one-page label headed
**"TEST — NOT A REAL SHIPMENT"**. Plus a switch that makes it refuse to quote a return, so
§2.3's fallback is exercised rather than merely written.

**The Shiprocket adapter — written and switched off twice.** `provider()` will not hand it out
unless `SHIPPING_PROVIDER=shiprocket`, and its own transport throws unless
`SHIPROCKET_ENABLED=true`. A test replaces the transport, calls all seven functions, and proves
none reaches the network. *(checks 33, 34)*

**The webhook — one handler, both providers.**
- *Idempotent* by a **unique index** on `dedupe_key`: the database refuses a duplicate, so the
  application never has to remember to.
- *Order-tolerant* because every state write is `COALESCE(col, $ts)` under `WHERE col IS NULL` —
  a late "out for delivery" after "delivered" records itself and moves nothing. An `applied`
  column says honestly which happened.
- *Raw payload always stored*, even for an event we do not act on.

**The zero-imports proof.** A test walks every file in `services/shipping/`, strips comments,
and fails on any `require` of `production*`, `contracts` or `campaign_*` — and a second test
proves the rule has teeth by running a planted import through the same matcher. That is what
lets **item 16** book a customer's order through this layer with no change.

### What only the live account can answer — for you

1. Whether **one INFLX account may hold a pickup location per brand branch**, and how many the
   plan allows. *Not blocking:* `brand_branch_pickups` is keyed `(branch_id, provider)`, correct
   either way.
2. The **webhook signature scheme** — header, algorithm, and whether it signs the raw body. Ours
   fails closed until it is known.
3. **Return-pickup coverage in Guntur and Vijayawada.** If reverse pickup is unavailable there,
   Q1's "she sends it back herself" stops being an edge case and becomes normal in two cities.
4. Whether a **return can be quoted at outbound booking time** at all. The lock design assumes
   it can; §2.3's fallback runs when it cannot.
5. Whether the **label URL is durable or short-lived**. We cache the PDF either way.
6. How a **weight-difference charge is notified** — webhook, or only a monthly statement. If the
   latter, that lane becomes an admin action rather than an event.
7. Whether a pickup can be scheduled for a **chosen day** (R12) or only "next working day".

---

## 5. The money, as it was actually written

`brands.wallet_balance` is the available balance; a "lock" is a debit plus an audit row. Four
**new** `wallet_tx_type` values, deliberately **not** `escrow_lock` — the wallet screen's
"Reserved" figure means money committed to *creators*, and a courier hold must not join it.

| Movement | Rows written |
|---|---|
| Outbound at booking | `courier_charge` debit |
| Return lock at booking | `courier_lock` debit |
| Refused when short | none — one **total** shortfall (`outbound + hold`), never two numbers to add up |
| Cancel before collection | `courier_refund` credit + `courier_lock_release` credit |
| Return settled at pickup | `courier_lock_release` credit (the whole hold), then `courier_charge` debit (the actual) |
| Return costs **more** than the lock | the difference charged, or a `brand_dues` row — **her pickup is never refused or delayed** |
| No Return left | `courier_lock_release` credit, whole |
| Back-to-store, weight charge | `courier_charge` debit with the courier's reason; a due when short |
| A due settled | `courier_charge` debit + `brand_dues.settled_at`, in the **same transaction** as the credit |

**The credit paths hooked for dues** — "next money in" means *every* credit that reaches
`brands.wallet_balance`, not only a top-up. I checked this **exhaustively**, not by sampling:
every write to `brands.wallet_balance` anywhere in `backend/src` was read, and exactly three
of them increase it.

1. **the wallet top-up** — `wallet.controller.js:227`
2. **a cancelled campaign's escrow refund** — `campaign.controller.js:1483`
3. **a rejected or failed brand withdrawal coming back** — `admin.controller.js:1282`

All three are hooked. The other brand-wallet writes are **debits** and correctly untouched:
signing an agreement (`contractSign.service.js:133`) and requesting a withdrawal
(`wallet.controller.js:359`). Every remaining `wallet_balance` credit in the codebase —
commission confirmation, referral earnings, tranche release, a reversed influencer withdrawal —
writes to `influencers` or `agencies`, never to a brand. Commerce settlement pays brands through
Razorpay Route, not the wallet, so there is no fourth.

Item 11's own two credits settle dues inside `remoteMoney.credit`. **Dues are never part-paid** —
a ₹200 credit against ₹180 and ₹400 owed clears the ₹180 whole and leaves the ₹400, because half
a courier charge reconciles against nothing when the aggregator's statement arrives. *(check 47)*

### Check 29 — the before-and-after snapshot

A complete Pay-for-Content shoot with a return: address → products → book → collect → deliver →
check → shoot done → book the return → collect → deliver → confirm. Snapshotted before and
after:

| | Result |
|---|---|
| `contracts.locked_amount` / `released_amount` | **identical** |
| `escrow_entries` (all three tranches, amounts and statuses) | **identical** |
| `influencers.wallet_balance` / `pending_balance` / `total_earned` | **identical** |
| `influencer_ledger` row count | **identical** |
| Every wallet row written during the shoot | **all `courier_*`**, all the brand's |

---

## 6. The Pay-for-Sale / Hybrid collaborations with no selling scope

**There are none.** You asked me to name them; the honest answer is that the question has an
empty result.

| Aim | Scope | Signed collaborations |
|---|---|---|
| Pay for Sale | `store` | 3 |
| Pay for Sale | `category` | 1 |
| Hybrid | `store` | 2 |
| **Pay for Content** | **NULL** | **2** |

The two rows with no scope are **`d3fde0dc-196b-48e6-a9c4-b4727570298b`** and
**`ef874178-35f5-418d-9e28-06fdb40e026c`** — both Kanchi Silks (practice) × Asha M. (practice),
both **Pay for Content**, where a null scope is *correct*: Pay for Content has no selling scope,
and those two see the whole published catalogue as they should. `SCOPE_NOT_SET` can never fire
for them.

**This corrects a line in my own gap report.** Q3 of it had the distinction right — *"For Pay for
Content that is correct… For Pay for Sale or Hybrid it means she may sell nothing"* — but left it
unresolved, and the roll-up line above it said flatly *"two of the eight signed collaborations in
production have no `alloc_scope` at all, and the picker would show them nothing."* That counted
the nulls without checking the aim, and it is the sentence you would have read first. Resolved
now: **the aim was never checked, and when checked, the count of affected collaborations is zero.**

Nothing needed fixing, and — per your instruction — **no scope has been written on either row.**
`SCOPE_NOT_SET` is still built and still tested (check 53), because the *next* Pay for Sale
collaboration signed without a scope will hit it.

---

## 7. Test results

Full backend suite, run serially against the test database, compared to
`baseline_item11.json` taken before the first line of item 11 was written.

| | Before | After |
|---|---|---|
| Suites | 126 (52 failing) | **131 (46 failing)** |
| Tests | 1430 | **1545** |
| Passing | 1198 | **1325** |
| Failing | 232 | **218** |

**Newly failing: 0.** **Gone: 0.** **Newly passing: 15.**

- **117 new tests**, all green: the 113 backend item-11 tests (`item11-phase2a` 14,
  `shipping-layer` 32, `item11-test-parcels` 13, `item11-remote-flow` 20,
  `item11-remote-return` 34), plus the 4 in `stage4-parcel` below.
- **The 2 "gone" are the same 2 tests, renamed** — they moved into a `describe.skip` block
  whose title now names this item, so the compare sees the old name leave and the new one
  arrive. Nothing was deleted; they are the only 2 skipped tests in the suite.
- **The 15 newly passing are not mine to claim.** They are pre-existing failures that
  cleared when the per-file phone-number collision was fixed in the test factories —
  suites were logging in as each other's brands. Fixing it was necessary to get a readable
  run at all, and it un-broke fifteen tests in billing, tax, search and cron that had
  nothing to do with item 11.
- **The 1 reported newly-failing was a timing flake, and I checked rather than assumed.**
  `section-banner-gateway` timed out at 30 s inside `truncateAll()` — a fixture hook, not an
  assertion. This run took 3918 s against the baseline's ~1800 s because the machine was
  loaded. Re-run alone it passes in 1.2 s, all 3 tests green. Not counted as a regression,
  and not left unexplained.
- **218 failures remain, and they are the pre-existing debt** — the same ~230 you already
  carry (registration validation against the fashion-only category rule, live-OTP paths, and
  similar). Item 11 did not add to it. The certification here is **no regression**, never
  "green".

**The `stage4-parcel` drift.** No assertion **failed** because of a retirement. Two became
**green but vacuous**, which is worse — a red test gets looked at.

| Assertion | Retirement that caused it | Where it went |
|---|---|---|
| `B-1 · the controller checks the parcel before dispatching` | `dispatch` → `RETIRED_DISPATCH`, thrown before the guard it greps for | `describe.skip(… [RETIRED by item 11])`, kept whole. Replaced by check 60, and for the rule itself by check 10 (F8 refuses `NO_LINES`) |
| `B-1 · the completion endpoint answers 403, not 422` | `complete` → `RETIRED_COMPLETE_REMOTE`, **Remote only** | Same block. Replaced by an executing test that calls `parcel.canComplete` for both modes, and by check 22 |

**Neither was deleted.** Two executing tests were added beside them.

---

## 8. The sixty checks

All sixty **pass**. The full table, each with the test that proves it, is
`features/item11-remote/03-expected-outputs.md`.

One deliberate exception is stated there rather than buried: the two **F1 reads** sit outside
check 1's gate loop, because R1 and R2 draw the gate *card* and a read that refused could not
draw it — item 10's own F1 settled that. Both reads **are** in check 3's mode loop.

---

## 9. Handover notes

**For the go-live item**

- **The delivery challan (Q6).** Not built. `shipments.challan_key` is nullable and waiting, so
  it can be added without a migration once your CA answers whether a challan or proforma invoice
  must travel with sample goods. The **declared value** is built and printed on the label.
- **GST invoicing of courier charges (Q7).** Not built. `shipments.gst_amount` is recorded on
  every charge so the data exists when INFLX starts invoicing brands for recharged shipping.
- **The nightly aggregator reconciliation (Q8).** Not built. `quoted_amount` and
  `charged_amount` are stored **separately** on every shipment, which is what makes the
  reconciliation possible at all.
- **The seven Shiprocket unknowns** — §4 above. Each is named in `shipping/shiprocket.js` beside
  the code it affects.

**For item 16 (customer orders)**

The whole of `services/shipping/` — the interface, `provider()`, the simulator, the adapter, the
webhook and its idempotency. `shipments.production_event_id` is **nullable**; item 16 adds
`follower_order_id` beside it and nothing else changes. The zero-imports test is what keeps that
true.

**For item 12 (content)**

Shoot done writes `production_events.influencer_completed_at` and `status = 'completed'` — the
same two things item 10 writes, so item 12 reads one vocabulary for both modes. No money moves.

**For item 18 (disputes)**

Item 11 **records** three kinds of report — `difference`, `return`, `overdue` — each once, on
`production_events`, with who and when. It builds no dispute handling.

**Still open, for you**

- **`return_window_days` 30 vs 7** — carried over from item 7, untouched here.
- The founder's own walkthrough setup: a wallet top-up, the Kanchi Silks main-branch address,
  and sizes on three products.

---

## Figures

```
BACKEND — full suite, serial, vs baseline_item11.json
  suites          126 (52 failed)   ->  131 (46 failed)
  tests           1430              ->  1545
  passed          1198              ->  1325
  failed          232               ->  218
  newly failing   0
  gone            0   (2 renamed into the skip block, 0 deleted)
  new             117  (117 green; 2 of them the renamed skips)
  newly passing   15   (phone-collision fix in the test factories, not item 11 features)

  item11 backend suites            113 / 113 green
    item11-phase2a                  14
    shipping-layer                  32
    item11-test-parcels             13
    item11-remote-flow              20
    item11-remote-return            34

MOBILE — full suite
  54 suites / 680 tests, all passing
  item11 mobile                     44  (remote11 19, remoteScreens 25)

GOVERNANCE
  qa/scripts/governance-check.mjs   OK
  59 governed changes, contract-backed; mockups locked; 06-diff notes present

CHECKS 1-60                          60 / 60 pass

DEPLOY STATE
  commits local, unpushed            8
  migration 191 against production   NOT RUN
  Render environment variables       NONE SET
  OTA publishes                      NONE
  real courier calls                 NONE
  production data written            NONE
```
