# Stage 4 — expected outputs

## 1. Database

| # | Assertion | Check |
|---|---|---|
| D-1 | `production_event_items` exists — one row per item, carrying the product, a quantity, and her verdict | migration + `\d` |
| D-2 | Additive: no existing `production_events` row is modified by the migration | row count and checksum before/after |
| D-3 | An item's verdict is one of: not yet answered · received · missing · damaged | executing test |
| D-4 | A resend creates a **second** parcel, never edits the first | executing test + the walk |
| D-5 | Confirming receipt leaves the event **`in_progress`**, not `completed` | executing test — the one behaviour change to a live endpoint |

## 2. Backend

| # | Assertion |
|---|---|
| B-1 | A shipment cannot be dispatched with nothing in it |
| B-2 | Items are chosen by product id, never free text |
| B-3 | She answers per item, and the sum of her answers is what the brand sees |
| B-4 | Flagging a shortfall notifies the brand, **naming the item** |
| B-5 | A shortfall never changes her ability to post, sell, or finish |
| B-6 | Dropping an item removes it from a **hand-picked** allocation only |
| B-7 | The visit date window and the two-reschedule cap behave exactly as they do today |
| B-8 | Every new action writes to `production_event_log` |
| B-9 | `collabStep` still returns **step 3** for a shipment whose parcel arrived but whose shoot is not done — the field it reads is the one D-5 changes |

## 3. Both phones

| # | Assertion |
|---|---|
| M-1 | The shoot is a route in **both** navigators, reached from step 3 |
| M-2 | The brand has one **Shoots** list across campaigns, needs-you first |
| M-3 | The visit screen shows the window **and the reason for it** |
| M-4 | Reschedules left are visible **before** they run out |
| M-5 | The parcel builder is the **same** picker component as allocation and offers — a fourth caller, not a fourth build |
| M-6 | She confirms per item, with a one-tap *"everything arrived"* |
| M-7 | A shortfall reads as the brand's problem |
| M-8 | The shoot's diary is reachable from both sides and identical |
| M-9 | No shot list, no brief, nowhere |
| M-10 | Every helper used is imported, and every `ig.*` token exists — the guard added on 26 August |

## 4. Regression and governance

| # | Assertion |
|---|---|
| R-1 | Contract signing unchanged |
| R-2 | Stage 3's ladder still reconciles; step 3 opens the shoot |
| R-3 | `pnpm qa` no-regression against the documented baseline. **Never claimed green** |
| R-4 | Both mobile suites green |
| R-5 | Duplicate-route check clean, both apps |
| R-6 | `06-diff/notes.md` written |
| R-7 | **Founder walks both handsets** |
| R-8 | A Maestro flow covers the shoot |

## 5. Not this stage's job to prove

* That content goes live in the right order — Stage 5
* Live courier tracking
* Goods moving creator to creator — deliberately out of `Docs/THE_PLAN.md`
