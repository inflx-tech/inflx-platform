# Stage 4 — before / after

Per board: **promised · built · diverged · what to check on the handset.**
Divergence is expected. Silent divergence is not.

---

## 1. The headline

**Built: all eight slices.** One additive table, four new endpoints, one behaviour change to a
live endpoint, three new screens across two apps, and a diary that has been recorded since
before this stage and was never once shown to anybody.

**Not built: the brand's default visit address** (board panel ②, the *"set once, used for every
store visit"* card). Divergence, stated in §4.

---

## 2. Panel by panel

### ② The shoots list

| | |
|---|---|
| **Promised** | One list across every creator, needs-you first |
| **Built** | `BrandShootsListScreen`, reached from a **Shoots** tile on the brand's home. Rows show mode, campaign, where the shoot has got to, and whose move it is |
| **Diverged** | The board's *"Your visit address · set once"* card is **not built** — see §4 |

The list is **brand-wide**, which is what M-2 asks for. `/campaigns/:id/production` already
existed and is scoped to one campaign — the wrong shape for the question a brand actually asks
in the morning, which is *"what is waiting on me today"*. Those shoots are spread across
whatever campaigns happen to be running, so a per-campaign roster meant opening four screens to
answer one. New endpoint: `GET /v1/brands/me/shoots`.

**Needs-you order is computed in SQL**, not on the phone — the same reasoning as Stage 3's step
number. Her app renders the same shoot; two clients each working out "whose turn" separately is
precisely how they come to disagree about one fact.

*On the handset:* it will look thin. Production holds **four** shoots. On a real brand with
twenty this is the most useful screen in the stage; on the practice shelf it is four rows.

### ③ Settling when

| | |
|---|---|
| **Promised** | The window, with the reason. Accept · suggest another · ask to go remote |
| **Built** | All three, on both phones, with reschedules-left shown *before* they run out (M-4) |
| **Diverged** | The window's reason needed a **new server field** — see below |

The board's biggest flagged risk was the reason line, and it was right for a reason I had not
expected: **`basis` did not exist.** `getVisitDateRange` returned `{ earliest, latest }` and
nothing else, so a screen wanting to explain *why* 28 August was the last legal day would have
had to re-derive the rule and guess. Worse, there are **four** branches, not three — a sales
campaign runs open-ended by design and has no end date to work back from, and "the window comes
from the campaign's dates" would have named a date that does not exist.

So the server now returns which of the four rules produced `latest`, and the phone turns that
into a sentence. Additive to the response; nothing reads it that did not ask for it.

*On the handset:* read the sentence as a creator would. If it still sounds arbitrary, it needs
different words, not different maths.

### ④ The parcel

| | |
|---|---|
| **Promised** | Products picked from the catalogue, courier, tracking, "Mark dispatched · 3 items" |
| **Built** | All of it. `ProductPickerModal` is the **fourth caller**, exactly as ledger #86 predicted — used, not modified |
| **Diverged** | Nothing |

**An empty box is refused** (B-1), and the refusal explains itself: *"she confirms the parcel
item by item, so an empty box gives her nothing to confirm."*

**A resend is a second parcel**, never an edit. The unique index is `(event, parcel_no,
product)` — if it were `(event, product)` the replacement would collide with the original row
and the fact that something went missing would be overwritten by the fix for it.

### ⑤ She confirms, item by item

| | |
|---|---|
| **Promised** | Tick per item, flag what is missing, mark one damaged, "Confirm — 2 of 3 received" |
| **Built** | All of it, plus **"Everything arrived"** as one tap (M-6) |
| **Diverged** | The one-tap button hides itself once she flags anything |

Most parcels arrive complete. Making her tick three chips to say *nothing went wrong* is a tax
on the outcome that happens nearly every time. But the fast path must never become the fast way
to dismiss a problem she has already started reporting — so the moment anything is flagged, it
disappears and the per-item answer takes over. Both paths hit the same endpoint and record a
verdict **per item**, so the brand is never left with an unreconcilable *"she said it was fine"*.

*On the handset:* the board calls this the likeliest wording failure in the stage. If *"you
don't have to chase it"* is not believed, she will message the brand anyway and the screen has
failed. Only a person can judge that.

### ⑥ The brand answers a shortfall

| | |
|---|---|
| **Promised** | Send the missing item, or drop it |
| **Built** | Both. Dropping tells her, and names the item |
| **Diverged** | Dropping touches the allocation **only on a hand-picked list** — flagged at lock, unchanged |

Store and category scopes are resolved live (Part 4 §4.1). A product still in the category is
still in scope, whether or not one copy went missing in a van. Carving a hole in a scope defined
as resolved-live would be inventing a rule that scope does not have.

### ⑦ The diary

| | |
|---|---|
| **Promised** | Every action, oldest first, identical on both sides |
| **Built** | `ShootDiary`, one component, rendered on both phones from the same rows |
| **Diverged** | Nothing |

The shoot is the **only** step in the whole six-step spine that has ever kept a diary, and
`getLog` existed with **nothing calling it**. The four new parcel actions write to the same log
rather than a second one — a separate parcel log would be two things doing one job, the fault
that cost Stage 1 four of its twenty-one bugs.

*On the handset:* it will be **nearly empty**. `production_event_log` has zero entries, because
the practice world was seeded straight into its end state rather than driven through the
endpoints. Only actions taken during the walk appear. The empty state says so rather than
inventing a history.

---

## 3. The one behaviour change to something already live

**Confirming receipt no longer completes the shoot.** It sets `in_progress`.

Without this, a courier handing over a box advanced her collaboration to step 4 before she had
photographed anything — and **both phones would have agreed on a number that was wrong**.

`collabStep` derives `shootDone` from exactly the field this changes, so it was re-checked
rather than reasoned about. **B-9 is pinned by an executing case**: after receipt the event is
`in_progress` with no completion timestamp, so `shoot_done` is false and the step stays **3**.
A second case asserts that the formula the test models is still the formula `collabCounts`
actually runs — so if that query changes, the pin fails loudly instead of quietly becoming a
fiction.

**Who may mark a shoot done now depends on the mode** — the founder's ruling, 2026-08-27:

* **store visit** — either party. The brand was there; they know it happened.
* **remote / shipment** — **the creator alone.** The brand cannot see whether she has shot
  anything, so letting them close it would be letting them assert something they cannot know.

Before this, a remote shoot had **no way of being marked done at all**: `complete` refused any
mode that was not `visit`, and the only other path was `confirmReceived`, which conflated the
box landing with the photographs being taken.

The rule is written once, in `parcel.service.canComplete`, and the phone's copy is pinned to it
by a test that compares the two objects. The phone's copy exists only so a button that would be
refused is never drawn; the server is the authority and answers **403**. Where the button is
absent, **the reason is on the screen** — a missing button with no explanation reads as a bug.

---

## 4. Divergence: the brand's default visit address

The board's panel ② carries a card reading *"Your visit address · Benz Circle, Vijayawada ·
Used for every store visit unless you change it per shoot."*

**Not built.** It is a brand-level default that does not exist in the schema, it is not named by
any assertion in `03-expected-outputs`, and it is not in the locked build order. Adding a column
and a settings screen on the strength of a decoration on a board would be widening the stage
without saying so.

Today the address is set per shoot, which works and is what every existing shoot does. If the
founder wants the default, it is a small, clean piece of its own work.

---

## 5. What was found while building, and fixed

1. **`basis` did not exist** on the date-range response (§2 ③). The reason line the board
   requires could not have been written truthfully without it.
2. **`countered` is not a status.** The five the server writes are `proposed`, `confirmed`,
   `in_progress`, `completed`, `cancelled`. A counter keeps the event `proposed` and flips
   `slot_proposed_by`. Reading status alone would have left **both phones saying "waiting on
   them" at the same time** — the exact disagreement Stage 3 was built to end. `turnOf` reads
   the field that actually changes, and a test asserts no label exists for a status the server
   cannot write.
3. **A native date picker would have crashed the app on launch.** The first draft imported
   `react-native-modal-datetime-picker`, which is not a dependency; the near-miss alternative,
   `@react-native-community/datetimepicker`, is in `package.json` but **nothing imports it**, so
   there is no evidence it is compiled into the installed APK — and an over-the-air bundle
   cannot add a native module. `DateField` exists for exactly this reason. A guard now fails if
   either import appears in a Stage 4 file.
4. **A `require` landed below its use** in `brand.routes.js` — a temporal-dead-zone throw at
   module load, which would have taken the whole API down on boot rather than failing one
   route. Moved, and pinned by a test asserting the require comes first.
5. **The spine had no `contract_id` to navigate with**, so step 3 would have shown a note
   instead of a button no matter what the screen did. Added to the live hierarchy as a
   `LEFT JOIN LATERAL` — a creator who has not signed has no contract, and that is a normal
   state, not a missing row. `production_mode` is aliased so it cannot shadow a `ci.*` column.
6. **A weak fixture in my own test.** The store/category cases passed `alloc_product_ids: null`,
   so the null-guard was doing the work and the scope check was never exercised — a mutation
   that let a store scope be carved into passed the case unchanged. Found by mutation testing,
   not by reading. Fixed, and the mutation is now caught.

---

## 6. How this was verified, given the test database is down

`backend/tests/*` cannot run: `jest.config.js` sets a `globalSetup` that connects to the test
database, unreachable since **2026-08-22**, so every suite dies on ECONNRESET before a single
assertion — including suites that never touch a database. That debt is unchanged and is not
fixed here.

| What | How |
|---|---|
| The decision rules | **25 executing checks** over the services with an injected connection, via `backend/scripts/run-test-file.js`. **25/25 pass** |
| Are those checks real? | **Mutation-tested.** Four rules broken one at a time — the brand allowed to close a remote shoot, receipt completing again, a store scope carved into, the empty-box guard moved after dispatch. **All four caught**, one only after fixing the weak fixture in §5.6 |
| The migration | **Dry-run against production inside a rolled-back transaction.** Applies cleanly, 14 columns, 3 indexes; `production_events` unchanged at 4 rows (D-2); table confirmed absent after rollback |
| Every new column | Run against production with `LIMIT 0` — Postgres resolves every name, so a typo fails there rather than on a handset. All four queries resolved |
| The phone | **50 executing checks**, `Packages/Mobile` jest, which needs no database. Route registration per navigator, cross-stack reachability, the completion rule pinned to the server's, every `ig.*` token, every API helper, no native imports |
| Are those real? | **Mutation-tested.** Five breakages — a duplicate route name, a route removed from a stack, the phone disagreeing with the server, step 3 reverted, a native picker imported. **All five caught** |
| Regression | Full mobile suite: **39 suites, 335 tests, all passing** |

**Certified no-regression against the documented baseline. Never claimed green** — the backend
suite has not run since 22 August and this stage does not change that.

---

## 7. Still open before release

* **The device walk.** New routes in two navigators, in five places. The gate is unchanged: the
  founder walks W1–W7 on both handsets before any deploy go.
* **`qa/maestro/flows/07-brand-shoot.yaml`** — written, **not yet run**. Needs a device.
* **The migration is not applied.** `161_production_event_items.sql` is dry-run-verified and
  waiting. Until it runs, `/brands/me/shoots` will 500, because it counts parcel items.
