# item11-remote — the sixty checks

The forty-one from the gap-check prompt §12.1, and the nineteen the approval added (§4.1).
Every row names the test that proves it. **Backend figures and the full-run compare are in
§13 of `Docs/ITEM11_REMOTE_GAP_REPORT.md` and in the build summary.**

Suites:
`A` = `item11-phase2a` · `S` = `shipping-layer` · `T` = `item11-test-parcels` ·
`F` = `item11-remote-flow` · `R` = `item11-remote-return` · `M` = mobile
(`remote11`, `remoteScreens`, `accessibilityStateBooleans`) · `P` = `stage4-parcel`

---

## Gate and mode

| # | Check | Result | Proof |
|---|---|---|---|
| 1 | Unsigned, and signed-but-unfunded PfC/Hybrid, reach no Remote path — proved by a loop | **Pass** | `R` "1 · a signed-but-unfunded Pay for Content collaboration reaches NO Remote path" — ten routes, each 422 `NOT_FUNDED` |
| 2 | Pay for Sale opens on signatures alone | **Pass** | `R` "2 · Pay for Sale opens on the two signatures alone" — `money.required: false` |
| 3 | A Store Visit collaboration is refused by every Remote endpoint, and a Remote one by every item 10 endpoint | **Pass** | `R` "3 · …with the mirror sentence" (eleven routes + her read); item 10's own `WRONG_MODE` is unchanged and still tested by `item10-storevisit` |

**One deliberate exception, stated plainly.** The two F1 **reads** are outside check 1's loop.
R1 and R2 draw the gate *card* — "signed, funded, first payment out", or which of those is
missing — and a read that refused could not draw it. Item 10's own F1 settled this
(`shootPlan.read` returns `gate` and never throws). Both reads ARE in check 3's loop, because a
Store Visit collaboration has no Remote screen to draw at all. Every door that CHANGES something
asserts both.

## Her address

| # | Check | Result | Proof |
|---|---|---|---|
| 4 | State and city pre-filled from her profile and changeable; name and number pre-filled | **Pass** | `F` check 4; `M` "R3 · her name, number, state and city arrive pre-filled" |
| 5 | 999 cannot be sent, with the message; 998 can, and the brand is warned before any Return | **Pass** | `F` check 5; `M` R4b (both halves); `F` "R5 · a no-return-pickup address warns the brand" |
| 6 | Sending locks it; a second send and any edit refused; a profile change moves nothing | **Pass** | `F` check 6 — her profile is moved to another city and the snapshot holds |
| 7 | The brand sees nothing before she sends; another brand never does; she never sees a branch street address | **Pass** | `F` check 7 (×2) and `A` check 42 |
| 8 | One correction after a back-to-store; a second, and one at any other time, refused | **Pass** | `F` check 8 |

## Products and booking

| # | Check | Result | Proof |
|---|---|---|---|
| 9 | Her scope for PfS/Hybrid, the catalogue for PfC, available only; outside the scope refused | **Pass** | `F` check 9 and the availability case |
| 10 | 0, 21 and 6-of-a-variant refused | **Pass** | `F` check 10 |
| 11 | GST-included prices; the return lock only when a line is Return | **Pass** | `F` check 11 |
| 12 | A short balance refuses with the exact shortfall; after adding money the same booking succeeds | **Pass** | `F` check 12; `M` R6b |
| 13 | Booking debits, locks, locks the list, returns a label; changing lines afterwards refused | **Pass** | `F` check 13 |
| 14 | Cancel before collection returns both and reopens the list; after collection refused | **Pass** | `F` check 14 (and Q5's repeat) |
| 15 | Two taps or two devices produce one booking and one debit | **Pass** | `F` check 15 — two concurrent `POST /book`, one 200 |

## Delivery

| # | Check | Result | Proof |
|---|---|---|---|
| 16 | Every simulated event arrives through the same webhook handler and produces the right state, notification and Needs You change | **Pass** | `R` check 16; `T` "a press moves the parcel through the SAME webhook handler" |
| 17 | The same event twice is one event; an out-of-order event changes nothing it shouldn't | **Pass** | `S` checks 16/17 (three cases); `R` check 17 |
| 18 | Back to the store charges the fee and allows exactly one rebooking | **Pass** | `R` check 18 |
| 19 | A weight charge is debited with its reason; short, it is owed; the creator is never blocked | **Pass** | `R` check 19 |

## Checking and shoot done

| # | Check | Result | Proof |
|---|---|---|---|
| 20 | Checking before delivery refused; one check per line; a difference notifies the brand and reaches Admin | **Pass** | `R` check 20; the log row is on `production_event_log`, which is the admin queue's source |
| 21 | A report is recorded once and nothing else happens | **Pass** | `R` check 55 |
| 22 | Shoot done refused before checking; after it the content step opens and no money moves | **Pass** | `R` check 22 — `status='completed'`, wallet unchanged |

## Returns

| # | Check | Result | Proof |
|---|---|---|---|
| 23 | The due date is the stamped window after the later of the posting date and shoot done, India time | **Pass** | `R` check 23 |
| 24 | Booking the return before shoot done, with nothing to send, or for today refused | **Pass** | `R` check 24 and the all-gifts case |
| 25 | The return settles from the lock and the remainder is released; the wallet history shows every charge | **Pass** | `R` check 25 |
| 26 | Return → Gift until booked, refused after; Gift → Return refused; no Return left releases the whole lock | **Pass** | `R` check 26 (×2) |
| 27 | The brand confirms each line; the job confirms at the stamped due unless reported; a later admin change moves nothing | **Pass** | `R` check 27 (×3) |
| 28 | Past the due with no pickup, both see it overdue and she is reminded; nothing moves | **Pass** | `R` check 28; the reminder is check 32's lane |

## Money

| # | Check | Result | Proof |
|---|---|---|---|
| 29 | Nothing is charged to the creator or taken from `contracts.locked_amount` — proved by balances and ledger before and after a complete shoot with a return | **Pass** | `R` check 29 — `locked_amount`, `escrow_entries`, her balances and `influencer_ledger` byte-identical; every wallet row written is `courier_*` |

## Delayed, Needs You, reminders

| # | Check | Result | Proof |
|---|---|---|---|
| 30 | Past the posting date it is flagged with the right Remote stage, both told once, everything stays usable | **Pass** | `R` check 30; all five stages accepted by the widened CHECK |
| 31 | Needs You shows the right move to the right side at each of the six points | **Pass** | `R` check 31 — `openMove` walked end to end; both counts extended |
| 32 | Each unanswered move reminded once at 48 hours, not again within 48; closed gates skipped | **Pass** | `R` check 32 |

## Simulator and provider

| # | Check | Result | Proof |
|---|---|---|---|
| 33 | Every shipment records its provider; a simulated one can never reach Shiprocket, nor the reverse | **Pass** | `S` check 33 (four cases) |
| 34 | The Shiprocket adapter makes no network call while switched off | **Pass** | `S` check 34 — the transport is reached and refuses before axios |
| 35 | Test parcels is Admin only, every press logged with who and when | **Pass** | `T` check 35 (×2) |
| 36 | Simulator labels read "TEST — NOT A REAL SHIPMENT"; tracking numbers start `TEST` | **Pass** | `S` check 36 |

## Access and states

| # | Check | Result | Proof |
|---|---|---|---|
| 37 | Another brand's or creator's shoot returns 404 | **Pass** | `F` check 7; `R` check 37 |
| 38 | Loading, empty and couldn't-load on every Remote screen, both sides | **Pass** | `M` check 38; every screen renders all three |
| 39 | `DangerButton` and every new confirm sheet honour `busy` | **Pass** | `M` check 39 — a second tap on the cancel sheet produces one call |
| 40 | `addParcelItems` works for the owning brand and is refused for any other | **Pass** | `A` check 40 (three cases) |
| 41 | Backend tests show no new failures against `baseline_item11.json` | **Pass** | `compare-tests.js` — see the build summary |

---

## The nineteen the approval added

| # | Check | Result | Proof |
|---|---|---|---|
| 42 | Before she sends, no endpoint returns `ship_to_*` or `delivery_address` to the brand; after, only the owning brand; no creator payload carries a branch street address | **Pass** | `A` check 42 (three cases) — `getProduction`, the roster, her collaboration read |
| 43 | The `delivery_address` prefill no longer runs at the brand's signature | **Pass** | `A` check 43 |
| 44 | A return costing more than its lock charges the difference; short, a due; her pickup never refused or delayed | **Pass** | `R` check 44 |
| 45 | With the simulator refusing return quotes, the lock equals the outbound price and settling works the same | **Pass** | `F` check 45; `S` §2.3 |
| 46 | A rebook charges a new outbound price and does not take the return lock twice | **Pass** | `R` check 18 |
| 47 | A due is settled by a credit on each hooked path, oldest-first, only as far as it reaches, in the same transaction — and never blocks a booking | **Pass** | `R` check 47 · **three paths hooked**: top-up, campaign escrow refund, rejected brand withdrawal |
| 48 | `gst_amount` on every simulated charge; `quoted_amount` and `charged_amount` recorded separately | **Pass** | `S` "the quote is GST-INCLUSIVE"; `F` check 13 |
| 49 | Deleting a production event with a shipment is refused by the database | **Pass** | `S` check 49 — `ON DELETE RESTRICT` |
| 50 | A 998 pincode: no lock, no pickup, "I've sent it back" stamps the clock, J1 confirms, overdue stops | **Pass** | `R` check 50; `M` Q1 |
| 51 | A 999 pincode on a rebook after a correction is refused with the not-deliverable sentence | **Pass** | `R` check 51 |
| 52 | A rebook keeps the same locked lines and clears and logs any earlier check | **Pass** | `R` check 52 |
| 53 | `SCOPE_NOT_SET` for PfS/Hybrid without a scope; PfC always sees the published catalogue | **Pass** | `F` check 53 (×2); `M` Q3 |
| 54 | A product with variants cannot be added without one; one without is added as itself; "at most 5" per `(product, variant)` | **Pass** | `F` check 54; `M` the row test |
| 55 | `difference`, `return` and `overdue` each record once; `overdue` refused before the due date | **Pass** | `R` check 55 |
| 56 | "It's fine, carry on" is recorded and survives a second device; changes nothing else | **Pass** | `R` check 56 |
| 57 | A branch without a street address and pincode cannot be selected on R6 and is refused by F7 and F8 with item 10's sentence | **Pass** | `F` check 57; `M` Q9 |
| 58 | `brand_branch_pickups` registers once per branch per provider, and again when the address changes | **Pass** | `S` check 58 |
| 59 | A reminder after a move change waits 48 hours from the new anchor | **Pass** | `R` check 59 |
| 60 | Every retired endpoint and job refuses or no longer runs, proved by the route-table loop; no Store Visit caller touched | **Pass** | `A` check 60 (six doors); `P` "as item 11 leaves it"; §2.9's audit named the live visit caller and left it alone |

---

## The `stage4-parcel` drift (approval §3.19)

**No assertion FAILED because of a retirement.** Two became **green but vacuous**, which is
worse — a red test gets looked at.

| Assertion | Retirement that caused it | Where it went |
|---|---|---|
| `B-1 · the controller checks the parcel before dispatching` | `dispatch` → `RETIRED_DISPATCH`, thrown before the guard it greps for | `describe.skip(... [RETIRED by item 11])`, kept whole. Replaced by `A` check 60 and, for the rule itself, `F` check 10 (F8 refuses `NO_LINES`) |
| `B-1 · the completion endpoint answers 403, not 422` | `complete` → `RETIRED_COMPLETE_REMOTE` **for Remote only** (§2.9 kept the Store Visit caller alive) | Same skipped block. Replaced by `P` "complete is retired for REMOTE ONLY", which executes `parcel.canComplete`, and by `R` check 22 |

Neither was deleted. Both sit in a skipped block naming this item, the retirement, and the test
that replaced them. Two new executing tests were added beside them.
